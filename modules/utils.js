/**
 * 日记本插件工具函数模块
 * 提供通用的工具函数和常量定义
 */

// 日记格式正则表达式
export const DIARY_REGEX = /［日记标题：([^］]+)］[\s\S]*?［日记时间：([^］]+)］[\s\S]*?［日记内容：([\s\S]*?)］/g;

// 插件常量
export const PLUGIN_NAME = 'diary';
export const WORLDBOOK_NAME = '日记本';

/**
 * 日记条目接口定义
 */
export class DiaryEntry {
  constructor(uid, title, time, content, charName) {
    this.uid = uid;
    this.title = title;
    this.time = time;
    this.content = content;
    this.charName = charName;
  }

  /**
   * 验证日记条目数据完整性
   */
  validate() {
    if (!this.title || this.title.trim() === '') {
      throw new Error('日记标题不能为空');
    }
    if (!this.time || this.time.trim() === '') {
      throw new Error('日记时间不能为空');
    }
    if (!this.content || this.content.trim() === '') {
      throw new Error('日记内容不能为空');
    }
    if (!this.charName || this.charName.trim() === '') {
      throw new Error('角色名称不能为空');
    }

    // 长度限制
    if (this.title.length > 100) {
      throw new Error('日记标题不能超过100个字符');
    }
    if (this.content.length > 5000) {
      throw new Error('日记内容不能超过5000个字符');
    }
  }
}

/**
 * 移动设备检测
 */
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768;
}

/**
 * 延迟函数
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 解析日记内容
 */
export function parseDiaryContent(messageText) {
  if (!messageText || typeof messageText !== 'string') {
    return null;
  }

  const match = DIARY_REGEX.exec(messageText);
  if (!match) {
    return null;
  }

  const [, title, time, content] = match;

  // 验证提取的内容
  if (!title?.trim() || !time?.trim() || !content?.trim()) {
    return null;
  }

  // 检查是否是模板内容
  if (isTemplateContent(title, time, content)) {
    return null;
  }

  return {
    title: title.trim(),
    time: time.trim(), 
    content: content.trim()
  };
}

/**
 * 检查是否是模板内容（避免保存模板占位符）
 */
function isTemplateContent(title, time, content) {
  const templateKeywords = [
    '{{', '}}', '标题', '时间', '内容',
    'title', 'time', 'content', 'xxx', 'xxxx'
  ];
  
  const allText = `${title} ${time} ${content}`.toLowerCase();
  return templateKeywords.some(keyword => allText.includes(keyword.toLowerCase()));
}

/**
 * 获取当前角色名称
 */
export function getCurrentCharacterName() {
  try {
    // 优先使用 SillyTavern 的角色数据
    if (window.SillyTavern?.characters?.length > 0) {
      const currentCharId = window.SillyTavern.characterId;
      if (currentCharId !== null && currentCharId !== undefined) {
        const character = window.SillyTavern.characters[currentCharId];
        return character?.name || '未知角色';
      }
    }
    
    // 备用方案：从全局变量获取
    return window.name2 || '未知角色';
  } catch (error) {
    console.warn('[日记本] 获取角色名称失败:', error);
    return '未知角色';
  }
}

/**
 * 生成唯一ID
 */
export function generateUID() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 安全的JSON解析
 */
export function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('[日记本] JSON解析失败:', error);
    return defaultValue;
  }
}

/**
 * 安全的JSON序列化
 */
export function safeJsonStringify(obj, defaultValue = '{}') {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (error) {
    console.warn('[日记本] JSON序列化失败:', error);
    return defaultValue;
  }
}

/**
 * 防抖函数
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 */
export function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  return function() {
    const context = this;
    const args = arguments;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function() {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * 获取聊天消息列表
 */
export function getChatMessages() {
  try {
    return window.SillyTavern?.chat || [];
  } catch (error) {
    console.warn('[日记本] 获取聊天消息失败:', error);
    return [];
  }
}

/**
 * 获取最新的AI消息
 */
export function getLatestAIMessage() {
  try {
    const messages = getChatMessages();
    // 从后往前找第一个非用户消息
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message.is_user && !message.is_system) {
        return message;
      }
    }
    return null;
  } catch (error) {
    console.warn('[日记本] 获取最新AI消息失败:', error);
    return null;
  }
}

/**
 * 获取Slash命令执行器
 */
export function getSlashCommandExecutor() {
  if (typeof executeSlashCommands !== 'undefined') {
    return executeSlashCommands;
  } else if (window.executeSlashCommands) {
    return window.executeSlashCommands;
  } else if (window.SillyTavern && window.SillyTavern.executeSlashCommands) {
    return window.SillyTavern.executeSlashCommands;
  }
  return null;
}

/**
 * 执行Slash命令的统一接口
 */
export async function executeSlashCommand(command) {
  const executeCmd = getSlashCommandExecutor();
  if (!executeCmd) {
    throw new Error('Slash命令执行器不可用');
  }
  return await executeCmd(command);
}

/**
 * 删除最新的两条消息（日记命令楼层+日记内容楼层）
 */
export async function deleteLatestTwoMessages() {
  try {
    const messages = getChatMessages();
    if (messages.length < 2) {
      console.warn('[日记本] 消息数量不足，无法删除');
      return false;
    }

    console.log(`[日记本] 准备删除最新的两条消息，当前消息总数: ${messages.length}`);
    
    const executeCmd = getSlashCommandExecutor();
    if (!executeCmd) {
      console.warn('[日记本] Slash命令执行器不可用，跳过删除消息');
      return false;
    }

    await executeCmd('/del 2');
    
    console.log('[日记本] 已成功删除最新的两条消息');
    return true;
  } catch (error) {
    console.error('[日记本] 删除消息失败:', error);
    toastr.warning('删除聊天记录失败，但日记已保存成功');
    return false;
  }
}

/**
 * 显示确认对话框
 */
export async function showConfirmDialog(message, title = '确认') {
  return new Promise((resolve) => {
    // 使用 SillyTavern 的弹窗系统
    const popup = new window.SillyTavern.Popup(
      `<div class="diary-confirm-dialog">
        <h3>${title}</h3>
        <p>${message}</p>
      </div>`,
      window.SillyTavern.POPUP_TYPE.CONFIRM,
      '',
      {
        okButton: '确定',
        cancelButton: '取消',
        wide: false
      }
    );
    
    popup.show().then((result) => {
      resolve(result === window.SillyTavern.POPUP_RESULT.AFFIRMATIVE);
    });
  });
}

/**
 * 显示输入对话框
 */
export async function showInputDialog(message, defaultValue = '', title = '输入') {
  return new Promise((resolve) => {
    const popup = new window.SillyTavern.Popup(
      `<div class="diary-input-dialog">
        <h3>${title}</h3>
        <p>${message}</p>
      </div>`,
      window.SillyTavern.POPUP_TYPE.INPUT,
      defaultValue,
      {
        okButton: '确定',
        cancelButton: '取消',
        wide: false
      }
    );
    
    popup.show().then((result) => {
      resolve(result !== window.SillyTavern.POPUP_RESULT.CANCELLED ? result : null);
    });
  });
}
