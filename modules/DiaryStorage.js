/**
 * 日记数据存储模块
 * 负责日记数据的世界书存储、读取、删除等操作
 */

import { DiaryEntry, generateUID, safeJsonParse, safeJsonStringify } from './utils.js';

export class DiaryStorage {
  constructor(worldbookName = '日记本') {
    this.worldbookName = worldbookName;
  }

  /**
   * 确保世界书存在
   */
  async ensureWorldbook() {
    try {
      console.log(`[日记本存储] 开始初始化世界书: ${this.worldbookName}`);
      
      // 尝试获取当前聊天世界书，如果失败就创建一个
      try {
        const result = await this.executeSlashCommand('/getchatbook');
        
        if (result && result.trim()) {
          console.log(`[日记本存储] 聊天世界书已存在: ${result}`);
          this.worldbookName = result.trim();
          return;
        }
        
        // 如果没有聊天世界书，尝试创建一个
        console.log(`[日记本存储] 未找到聊天世界书，尝试创建: ${this.worldbookName}`);
        const createResult = await this.executeSlashCommand(`/getchatbook name="${this.worldbookName}"`);
        
        if (createResult && createResult.trim()) {
          console.log(`[日记本存储] 世界书创建成功: ${createResult}`);
          this.worldbookName = createResult.trim();
        } else {
          console.log(`[日记本存储] 使用默认世界书配置: ${this.worldbookName}`);
        }
        
      } catch (error) {
        console.warn('[日记本存储] 世界书操作失败，使用默认配置:', error.message);
        console.log(`[日记本存储] 使用默认世界书配置: ${this.worldbookName}`);
      }
      
    } catch (error) {
      console.warn('[日记本存储] 世界书初始化警告:', error.message);
      // 不抛出错误，允许插件继续运行
    }
  }

  /**
   * 执行Slash命令的统一接口
   */
  async executeSlashCommand(command) {
    try {
      // 首先尝试直接调用全局函数
      if (typeof window.executeSlashCommands === 'function') {
        return await window.executeSlashCommands(command);
      }
      
      // 备用方案：尝试通过SillyTavern对象
      if (window.SillyTavern && typeof window.SillyTavern.executeSlashCommands === 'function') {
        return await window.SillyTavern.executeSlashCommands(command);
      }
      
      // 最后尝试通过全局executeSlashCommands
      if (typeof executeSlashCommands !== 'undefined') {
        return await executeSlashCommands(command);
      }
      
      throw new Error('executeSlashCommands函数不可用');
    } catch (error) {
      console.error(`[日记本存储] 执行Slash命令失败 (${command}):`, error);
      throw error;
    }
  }

  /**
   * 获取所有日记数据
   */
  async getAllDiaries() {
    try {
      await this.ensureWorldbook();
      
      // 使用命令行方式获取世界书条目
      console.log(`[日记本存储] 开始加载日记数据，世界书: ${this.worldbookName}`);
      
      const diariesByCharacter = {};
      
      // 由于SillyTavern的世界书API限制，这里我们暂时返回空数据
      // 实际的日记数据将在创建时通过命令操作
      console.log('[日记本存储] 世界书数据加载完成，等待实际数据操作');
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
      
      // 使用统一的slash命令接口创建条目
      const createResult = await this.executeSlashCommand(`/createentry file="${this.worldbookName}" key="${finalCharName}" "${content}"`);

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
      // 设置条目名称（注释字段）
      await this.executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="comment" "${entryName}"`);

      // 设置条目为选择性触发
      await this.executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="selective" 1`);

      // 设置触发逻辑为 AND_ANY (0)
      await this.executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="selectiveLogic" 0`);

      // 设置插入位置为 after main prompt (1)
      await this.executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="position" 1`);

      // 在内容中包含结构化的日记数据
      const structuredContent = this.createStructuredContent(title, time, content, charName);
      await this.executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="content" "${structuredContent}"`);

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
      
      try {
        // 首先检查条目是否存在
        const entryContent = await this.executeSlashCommand(`/getentryfield file="${this.worldbookName}" field="content" "${uid}"`);

        if (!entryContent || entryContent.trim() === '') {
          console.warn(`[日记本存储] 条目不存在或已被删除 (UID: ${uid})`);
          return false;
        }
      } catch (error) {
        console.warn(`[日记本存储] 无法检查条目状态 (UID: ${uid}):`, error);
        // 继续尝试删除
      }

      // 删除条目（通过设置内容为空）
      await this.executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="content" ""`);

      // 禁用条目
      await this.executeSlashCommand(`/setentryfield file="${this.worldbookName}" uid="${uid}" field="disable" 1`);

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
