/**
 * 日记数据存储模块
 * 负责日记数据的世界书存储、读取、删除等操作
 */

import { DiaryEntry, generateUID, safeJsonParse, safeJsonStringify, getSlashCommandExecutor, executeSlashCommand } from './utils.js';

export class DiaryStorage {
  constructor(worldbookName = '日记本') {
    this.worldbookName = worldbookName;
  }

  /**
   * 确保世界书存在
   */
  async ensureWorldbook() {
    try {
      // 延迟检查，给SillyTavern更多时间加载
      await new Promise(resolve => setTimeout(resolve, 1000));

      const executeCmd = getSlashCommandExecutor();
      if (!executeCmd) {
        console.log('[日记本存储] Slash命令执行器暂时不可用，使用默认世界书配置');
        return;
      }

      try {
        // 尝试获取当前聊天世界书
        const result = await executeSlashCommand('/getchatbook');
        
        if (result && result.trim()) {
          console.log(`[日记本存储] 世界书已存在: ${result}`);
          this.worldbookName = result.trim();
          return;
        }
      } catch (error) {
        console.log('[日记本存储] 获取聊天世界书失败，使用默认配置:', error.message);
      }

      // 使用默认配置
      console.log(`[日记本存储] 使用默认世界书配置: ${this.worldbookName}`);
      
    } catch (error) {
      console.log('[日记本存储] 世界书初始化完成（使用默认配置）');
      // 不抛出错误，允许插件继续运行
    }
  }

  /**
   * 获取所有日记数据
   */
  async getAllDiaries() {
    try {
      await this.ensureWorldbook();
      
      // 尝试使用世界书 API 获取所有条目
      let worldbook = null;
      
      try {
        // 尝试多种方式访问世界书
        if (typeof loadWorldInfo !== 'undefined') {
          worldbook = await loadWorldInfo(this.worldbookName);
        } else if (window.loadWorldInfo) {
          worldbook = await window.loadWorldInfo(this.worldbookName);
        } else if (window.SillyTavern?.loadWorldInfo) {
          worldbook = await window.SillyTavern.loadWorldInfo(this.worldbookName);
        } else {
          console.warn('[日记本存储] 世界书加载功能不可用');
          return {};
        }
      } catch (error) {
        console.warn('[日记本存储] 世界书加载失败:', error.message);
        return {};
      }
      
      if (!worldbook || !worldbook.entries) {
        console.log('[日记本存储] 世界书为空或不存在');
        return {};
      }

      const diariesByCharacter = {};
      
      // 遍历世界书条目，提取日记数据
      Object.values(worldbook.entries).forEach(entry => {
        try {
          const diaryData = this.parseDiaryEntry(entry);
          if (diaryData) {
            const { charName } = diaryData;
            if (!diariesByCharacter[charName]) {
              diariesByCharacter[charName] = [];
            }
            diariesByCharacter[charName].push(diaryData);
          }
        } catch (error) {
          console.warn(`[日记本存储] 解析条目失败 (${entry.comment}):`, error);
        }
      });

      // 按时间排序每个角色的日记
      Object.keys(diariesByCharacter).forEach(charName => {
        diariesByCharacter[charName].sort((a, b) => {
          try {
            return new Date(b.time) - new Date(a.time);
          } catch {
            return b.time.localeCompare(a.time);
          }
        });
      });

      console.log(`[日记本存储] 已加载日记数据:`, diariesByCharacter);
      return diariesByCharacter;
    } catch (error) {
      console.error('[日记本存储] 获取日记数据失败:', error);
      throw new Error(`获取日记数据失败: ${error.message}`);
    }
  }

  /**
   * 创建新的日记条目
   */
  async createDiaryEntry(title, time, content, charName, customCharName = null) {
    try {
      await this.ensureWorldbook();

      // 使用自定义角色名（如果提供）或默认角色名
      const finalCharName = customCharName || charName;
      
      // 验证数据
      const diaryEntry = new DiaryEntry(generateUID(), title, time, content, finalCharName);
      diaryEntry.validate();

      // 创建世界书条目名称：标题-时间
      const entryName = `${title}-${time}`;
      
      // 使用正确的slash命令创建条目
      if (!getSlashCommandExecutor()) {
        throw new Error('Slash命令执行器不可用，无法创建日记条目');
      }

      const createResult = await executeSlashCommand(`/createentry file="${this.worldbookName}" key="${finalCharName}" "${content}"`);

      const uid = createResult?.trim();
      if (!uid) {
        throw new Error('创建条目失败：没有返回有效的UID');
      }

      // 设置条目的详细信息
      await this.updateEntryDetails(uid, entryName, title, time, content, finalCharName);
      
      console.log(`[日记本存储] 成功创建日记条目: ${entryName} (UID: ${uid})`);
      
      // 返回包含UID的日记条目
      return { ...diaryEntry, uid };
    } catch (error) {
      console.error('[日记本存储] 创建日记条目失败:', error);
      throw new Error(`创建日记失败: ${error.message}`);
    }
  }

  /**
   * 更新条目的详细信息
   */
  async updateEntryDetails(uid, entryName, title, time, content, charName) {
    try {
      if (!getSlashCommandExecutor()) {
        console.warn('[日记本存储] Slash命令执行器不可用，跳过条目详情更新');
        return;
      }

      // 设置条目名称（注释字段）
      await executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="comment" "${entryName}"`);

      // 设置条目为选择性触发
      await executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="selective" 1`);

      // 设置触发逻辑为 AND_ANY (0)
      await executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="selectiveLogic" 0`);

      // 设置插入位置为 after main prompt (1)
      await executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="position" 1`);

      // 在内容中包含结构化的日记数据
      const structuredContent = this.createStructuredContent(title, time, content, charName);
      await executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="content" "${structuredContent}"`);

    } catch (error) {
      console.warn('[日记本存储] 更新条目详细信息失败:', error);
      // 不抛出错误，因为基本创建已经成功
    }
  }

  /**
   * 创建结构化的日记内容
   */
  createStructuredContent(title, time, content, charName) {
    // 在内容前加入元数据注释，便于解析
    const metadata = {
      diaryTitle: title,
      diaryTime: time,
      diaryCharacter: charName,
      createdAt: new Date().toISOString()
    };
    
    return `<!-- 日记元数据: ${safeJsonStringify(metadata)} -->\n${content}`;
  }

  /**
   * 删除日记条目
   */
  async deleteDiaryEntry(uid) {
    try {
      await this.ensureWorldbook();
      
      const executeCmd = typeof executeSlashCommands !== 'undefined' 
        ? executeSlashCommands 
        : window.executeSlashCommands;

      if (!executeCmd) {
        throw new Error('Slash命令执行器不可用');
      }

      try {
        // 首先检查条目是否存在
        const entryContent = await executeCmd(`/getentryfield file="${this.worldbookName}" field="content" "${uid}"`);

        if (!entryContent || entryContent.trim() === '') {
          console.warn(`[日记本存储] 条目不存在或已被删除 (UID: ${uid})`);
          return false;
        }
      } catch (error) {
        console.warn(`[日记本存储] 无法检查条目状态 (UID: ${uid}):`, error);
        // 继续尝试删除
      }

      // 删除条目（通过设置内容为空）
      await executeCmd(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="content" ""`);

      // 禁用条目
      await executeCmd(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="disable" 1`);

      console.log(`[日记本存储] 成功删除日记条目 (UID: ${uid})`);
      return true;
    } catch (error) {
      console.error('[日记本存储] 删除日记条目失败:', error);
      throw new Error(`删除日记失败: ${error.message}`);
    }
  }

  /**
   * 解析世界书条目为日记数据
   */
  parseDiaryEntry(entry) {
    try {
      if (!entry || !entry.content || entry.disable) {
        return null;
      }

      // 获取角色名（从关键词中获取）
      const charName = this.extractCharacterName(entry);
      if (!charName) {
        return null;
      }

      // 解析条目名称获取标题和时间
      const { title, time } = this.parseDiaryName(entry.comment || '');
      if (!title || !time) {
        return null;
      }

      // 提取纯内容（去除元数据注释）
      const content = this.extractPureContent(entry.content);
      if (!content) {
        return null;
      }

      // 检查是否是模板内容
      if (this.isTemplateContent(title, time, content)) {
        return null;
      }

      return new DiaryEntry(entry.id, title, time, content, charName);
    } catch (error) {
      console.warn('[日记本存储] 解析日记条目失败:', error);
      return null;
    }
  }

  /**
   * 从条目中提取角色名称
   */
  extractCharacterName(entry) {
    try {
      // 从关键词中获取角色名
      if (entry.key && entry.key.length > 0) {
        return entry.key[0];
      }
      
      // 从元数据中提取
      const metadata = this.extractMetadata(entry.content);
      if (metadata && metadata.diaryCharacter) {
        return metadata.diaryCharacter;
      }

      return null;
    } catch (error) {
      console.warn('[日记本存储] 提取角色名称失败:', error);
      return null;
    }
  }

  /**
   * 解析日记名称（从comment字段）
   */
  parseDiaryName(comment) {
    try {
      if (!comment) {
        return { title: '', time: '' };
      }

      // 查找最后一个连字符，前面是标题，后面是时间
      const lastDashIndex = comment.lastIndexOf('-');
      if (lastDashIndex === -1) {
        return { title: comment, time: '' };
      }

      const title = comment.substring(0, lastDashIndex).trim();
      const time = comment.substring(lastDashIndex + 1).trim();

      return { title, time };
    } catch (error) {
      console.warn('[日记本存储] 解析日记名称失败:', error);
      return { title: '', time: '' };
    }
  }

  /**
   * 提取纯内容（去除元数据）
   */
  extractPureContent(content) {
    try {
      if (!content) {
        return '';
      }

      // 移除元数据注释
      const metadataRegex = /<!--\s*日记元数据:.*?-->\s*/;
      return content.replace(metadataRegex, '').trim();
    } catch (error) {
      console.warn('[日记本存储] 提取纯内容失败:', error);
      return content;
    }
  }

  /**
   * 提取元数据
   */
  extractMetadata(content) {
    try {
      const metadataMatch = content.match(/<!--\s*日记元数据:\s*(.*?)\s*-->/);
      if (metadataMatch) {
        return safeJsonParse(metadataMatch[1]);
      }
      return null;
    } catch (error) {
      console.warn('[日记本存储] 提取元数据失败:', error);
      return null;
    }
  }

  /**
   * 检查是否是模板内容
   */
  isTemplateContent(title, time, content) {
    const templateKeywords = [
      '{{', '}}', '标题', '时间', '内容', 
      'title', 'time', 'content', 'xxx', 'xxxx'
    ];
    
    const allText = `${title} ${time} ${content}`.toLowerCase();
    return templateKeywords.some(keyword => 
      allText.includes(keyword.toLowerCase())
    );
  }

  /**
   * 获取日记统计信息
   */
  async getDiaryStats() {
    try {
      const diaries = await this.getAllDiaries();
      const characters = Object.keys(diaries);
      const totalDiaries = characters.reduce((sum, char) => sum + diaries[char].length, 0);
      
      return {
        totalDiaries,
        totalCharacters: characters.length,
        characters: characters.map(char => ({
          name: char,
          count: diaries[char].length
        }))
      };
    } catch (error) {
      console.error('[日记本存储] 获取统计信息失败:', error);
      return {
        totalDiaries: 0,
        totalCharacters: 0,
        characters: []
      };
    }
  }

  /**
   * 导出所有日记数据
   */
  async exportAllDiaries() {
    try {
      const diaries = await this.getAllDiaries();
      const exportData = {
        exportTime: new Date().toISOString(),
        worldbookName: this.worldbookName,
        data: diaries
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('[日记本存储] 导出日记失败:', error);
      throw new Error(`导出日记失败: ${error.message}`);
    }
  }

  /**
   * 清空所有日记数据
   */
  async clearAllDiaries() {
    try {
      const diaries = await this.getAllDiaries();
      let deletedCount = 0;
      
      for (const character of Object.keys(diaries)) {
        for (const diary of diaries[character]) {
          if (await this.deleteDiaryEntry(diary.uid)) {
            deletedCount++;
          }
        }
      }
      
      console.log(`[日记本存储] 已清空 ${deletedCount} 条日记`);
      return deletedCount;
    } catch (error) {
      console.error('[日记本存储] 清空日记失败:', error);
      throw new Error(`清空日记失败: ${error.message}`);
    }
  }
}
