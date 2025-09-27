/**
 * 日记消息解析模块
 * 负责监听消息、解析日记内容、自动删除消息等功能
 */

import { parseDiaryContent, getCurrentCharacterName, getLatestAIMessage, deleteLatestTwoMessages, delay } from './utils.js';

export class DiaryParser {
  constructor(diaryStorage, presetManager) {
    this.diaryStorage = diaryStorage;
    this.presetManager = presetManager;
    
    // 监听状态
    this.isListening = false;
    this.messageListener = null;
    this.timeoutId = null;
    
    // 预设管理
    this.presetPreparationResult = null;
    
    // 重试和失败状态管理
    this.retryCount = 0;
    this.maxRetries = 3;
    this.hasShownFailureWarning = false;
    this.isTerminallyFailed = false;
    
    // 自定义角色名支持
    this.customCharacterName = null;
    
    // 删除保护和重试定时器管理
    this.hasDeletionExecuted = false;
    this.retryTimerIds = new Set();
  }

  /**
   * 开始监听消息（完整流程，包含预设管理）
   */
  async startListening() {
    try {
      if (this.isListening) {
        console.log('[日记解析] 已在监听状态，先停止当前监听');
        await this.stopListening();
      }

      console.log('[日记解析] 开始准备日记监听环境...');
      
      // 重置状态
      this.resetListenerState();
      
      // 检查是否是移动端
      const isMobile = this.detectMobile();
      if (isMobile) {
        console.log('[日记解析] 检测到移动端环境');
      }

      // 准备预设（如果配置了的话）
      try {
        console.log('[日记解析] 准备日记预设...');
        this.presetPreparationResult = await this.presetManager.prepareDiaryPresetWithMobileSupport();
        
        if (!this.presetPreparationResult.success && isMobile) {
          console.warn('[日记解析] 移动端预设准备失败，但继续监听');
          // 移动端环境下即使预设失败也继续
          this.presetPreparationResult = { success: true };
        }
      } catch (error) {
        console.error('[日记解析] 预设准备失败:', error);
        this.presetPreparationResult = { success: false };
        
        if (!isMobile) {
          throw new Error(`预设切换失败: ${error.message}`);
        }
      }

      // 开始消息监听
      await this.startMessageListener();
      
      console.log('[日记解析] 日记监听已启动，等待AI回复...');
      
      // 移动端给用户额外提示
      if (isMobile) {
        toastr.info('移动端环境已检测，请耐心等待AI回复', '日记监听已启动');
      } else {
        toastr.success('请在AI回复后自动保存日记', '日记监听已启动');
      }
      
      return true;
    } catch (error) {
      console.error('[日记解析] 启动监听失败:', error);
      
      // 清理状态
      await this.stopListening();
      
      throw error;
    }
  }

  /**
   * 移动设备检测
   */
  detectMobile() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileKeywords = [
      /Android/i, /webOS/i, /iPhone/i, /iPad/i, /iPod/i, 
      /BlackBerry/i, /Windows Phone/i, /Opera Mini/i
    ];
    
    const isMobileUserAgent = mobileKeywords.some(keyword => keyword.test(userAgent));
    const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 1024;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    return isMobileUserAgent || (isSmallScreen && isTouchDevice);
  }

  /**
   * 开始监听消息（仅监听，不含预设管理）
   */
  async startListeningWithoutPresetManagement() {
    try {
      if (this.isListening) {
        console.log('[日记解析] 已在监听状态');
        return;
      }

      console.log('[日记解析] 开始消息监听（不含预设管理）...');
      
      // 重置状态
      this.resetListenerState();
      
      await this.startMessageListener();
      
      console.log('[日记解析] 消息监听已启动');
      return true;
    } catch (error) {
      console.error('[日记解析] 启动消息监听失败:', error);
      throw error;
    }
  }

  /**
   * 启动消息监听器
   */
  async startMessageListener() {
    if (this.isListening) {
      return;
    }

    this.isListening = true;
    
    // 创建消息监听器
    this.messageListener = (eventData) => {
      // 检查事件数据
      if (eventData && typeof eventData === 'object') {
        const messageId = eventData.messageId || eventData.message_id || eventData.id;
        if (messageId !== undefined && messageId !== null) {
          this.handleMessage(messageId);
          return;
        }
      }
      
      // 如果直接传入了messageId
      if (typeof eventData === 'number') {
        this.handleMessage(eventData);
        return;
      }
      
      console.warn('[日记解析] 收到无效的消息事件:', eventData);
    };

    // 监听SillyTavern的消息事件
    try {
      // 监听AI消息生成完成事件
      window.SillyTavern.eventSource.on('MESSAGE_RECEIVED', this.messageListener);
      window.SillyTavern.eventSource.on('message_added', this.messageListener);
      
      // 备用：监听聊天更新事件
      window.SillyTavern.eventSource.on('chat_update', this.messageListener);
      
      console.log('[日记解析] 消息监听器已注册');
    } catch (error) {
      console.error('[日记解析] 注册消息监听器失败:', error);
      this.isListening = false;
      throw error;
    }
  }

  /**
   * 停止监听消息（仅停止监听，不含预设管理）
   */
  async stopListeningWithoutPresetManagement() {
    try {
      if (!this.isListening) {
        return;
      }

      console.log('[日记解析] 停止消息监听...');
      
      // 移除消息监听器
      if (this.messageListener) {
        window.SillyTavern.eventSource.removeListener('MESSAGE_RECEIVED', this.messageListener);
        window.SillyTavern.eventSource.removeListener('message_added', this.messageListener);
        window.SillyTavern.eventSource.removeListener('chat_update', this.messageListener);
        this.messageListener = null;
      }
      
      // 清理定时器
      this.clearAllRetryTimers();
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      
      this.isListening = false;
      console.log('[日记解析] 消息监听已停止');
    } catch (error) {
      console.error('[日记解析] 停止消息监听失败:', error);
    }
  }

  /**
   * 开始监听（使用自定义角色名）
   */
  async startListeningWithCustomCharacter(customCharacterName) {
    this.customCharacterName = customCharacterName;
    console.log(`[日记解析] 使用自定义角色名开始监听: ${customCharacterName}`);
    return await this.startListening();
  }

  /**
   * 停止监听（清除自定义角色名）
   */
  async stopListeningWithCustomCharacter() {
    this.customCharacterName = null;
    console.log('[日记解析] 清除自定义角色名并停止监听');
    return await this.stopListening();
  }

  /**
   * 停止监听（完整流程，包含预设恢复）
   */
  async stopListening() {
    try {
      console.log('[日记解析] 停止日记监听...');
      
      // 停止消息监听
      await this.stopListeningWithoutPresetManagement();
      
      // 恢复预设
      if (this.presetPreparationResult?.success && this.presetPreparationResult?.previousPreset) {
        try {
          console.log('[日记解析] 恢复之前的预设...');
          await this.presetManager.restorePreviousPreset();
        } catch (error) {
          console.warn('[日记解析] 恢复预设失败，但不影响功能:', error);
        }
      }
      
      // 重置状态
      this.resetListenerState();
      
      console.log('[日记解析] 日记监听已完全停止');
    } catch (error) {
      console.error('[日记解析] 停止监听失败:', error);
    }
  }

  /**
   * 重置监听器状态
   */
  resetListenerState() {
    this.retryCount = 0;
    this.hasShownFailureWarning = false;
    this.isTerminallyFailed = false;
    this.customCharacterName = null;
    this.presetPreparationResult = null;
    this.resetDeletionState();
    this.clearAllRetryTimers();
  }

  /**
   * 处理新消息
   */
  async handleMessage(messageId) {
    try {
      // 防止重复处理
      if (this.isTerminallyFailed) {
        return;
      }

      console.log(`[日记解析] 检测到新消息 ID: ${messageId}`);
      
      // 获取消息内容
      const message = this.getMessageById(messageId);
      if (!message) {
        console.warn(`[日记解析] 无法获取消息内容 (ID: ${messageId})`);
        return;
      }

      // 检查是否是AI消息
      if (message.is_user || message.is_system) {
        console.log('[日记解析] 跳过用户或系统消息');
        return;
      }

      // 处理日记内容
      const success = await this.processDiaryMessage(message.mes);
      if (success) {
        console.log('[日记解析] 日记处理成功，停止监听');
        await this.stopListening();
      }
    } catch (error) {
      console.error('[日记解析] 处理消息失败:', error);
      this.handleProcessingFailure(error);
    }
  }

  /**
   * 根据ID获取消息
   */
  getMessageById(messageId) {
    try {
      const messages = window.SillyTavern?.chat || [];
      return messages.find(msg => msg.message_id === messageId) || messages[messageId];
    } catch (error) {
      console.warn('[日记解析] 获取消息失败:', error);
      return null;
    }
  }

  /**
   * 清理所有重试定时器
   */
  clearAllRetryTimers() {
    this.retryTimerIds.forEach(timerId => {
      clearTimeout(timerId);
    });
    this.retryTimerIds.clear();
  }

  /**
   * 重置删除状态
   */
  resetDeletionState() {
    this.hasDeletionExecuted = false;
  }

  /**
   * 重新启动监听器（用于重试）
   */
  restartListener() {
    const timerId = setTimeout(async () => {
      try {
        console.log('[日记解析] 重新启动监听器...');
        
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`[日记解析] 重试第 ${this.retryCount}/${this.maxRetries} 次`);
          
          // 重置删除状态，允许重新尝试
          this.resetDeletionState();
          
          // 重新开始监听（不重新切换预设）
          await this.startListeningWithoutPresetManagement();
          
          toastr.info(`正在重试监听 (${this.retryCount}/${this.maxRetries})`, '日记监听');
        } else {
          console.warn('[日记解析] 已达到最大重试次数，终止监听');
          this.isTerminallyFailed = true;
          
          if (!this.hasShownFailureWarning) {
            this.hasShownFailureWarning = true;
            toastr.error('多次尝试失败，请手动使用"记录"功能', '自动监听已停止');
          }
          
          await this.stopListening();
        }
      } catch (error) {
        console.error('[日记解析] 重启监听器失败:', error);
        await this.stopListening();
      }
      
      this.retryTimerIds.delete(timerId);
    }, 5000); // 5秒后重试
    
    this.retryTimerIds.add(timerId);
  }

  /**
   * 处理日记消息
   */
  async processDiaryMessage(messageText) {
    try {
      console.log('[日记解析] 开始处理日记内容...');
      
      // 解析日记内容
      const parsedDiary = parseDiaryContent(messageText);
      if (!parsedDiary) {
        console.log('[日记解析] 未找到有效的日记格式');
        return false;
      }

      console.log('[日记解析] 解析成功:', parsedDiary);
      
      // 获取角色名（使用自定义角色名或当前角色名）
      const charName = this.customCharacterName || getCurrentCharacterName();
      console.log(`[日记解析] 使用角色名: ${charName}`);
      
      // 保存到存储
      const saveSuccess = await this.diaryStorage.createDiaryEntry(
        parsedDiary.title,
        parsedDiary.time,
        parsedDiary.content,
        charName,
        this.customCharacterName // 传递自定义角色名
      );

      if (!saveSuccess) {
        throw new Error('保存到世界书失败');
      }

      console.log('[日记解析] 日记保存成功');
      toastr.success(`日记"${parsedDiary.title}"已保存`, '保存成功');

      // 自动删除消息（如果启用）
      const shouldAutoDelete = await this.getShouldAutoDelete();
      if (shouldAutoDelete && !this.hasDeletionExecuted) {
        try {
          this.hasDeletionExecuted = true;
          console.log('[日记解析] 开始自动删除聊天记录...');
          
          await delay(1000); // 等待1秒确保保存完成
          const deleteSuccess = await deleteLatestTwoMessages();
          
          if (deleteSuccess) {
            toastr.info('聊天记录已自动清理', '日记保存完成');
          }
        } catch (deleteError) {
          console.warn('[日记解析] 自动删除失败:', deleteError);
          toastr.warning('日记已保存，但删除聊天记录失败', '部分成功');
        }
      }

      return true;
    } catch (error) {
      console.error('[日记解析] 处理日记失败:', error);
      toastr.error(`处理日记失败: ${error.message}`, '错误');
      return false;
    }
  }

  /**
   * 获取当前角色名称
   */
  getCurrentCharacterName() {
    return getCurrentCharacterName();
  }

  /**
   * 获取是否应该自动删除
   */
  async getShouldAutoDelete() {
    try {
      const settings = window.SillyTavern.extensionSettings['diary'] || {};
      return settings.autoDelete !== false; // 默认为true
    } catch (error) {
      console.warn('[日记解析] 获取自动删除设置失败:', error);
      return true; // 默认启用
    }
  }

  /**
   * 处理处理失败
   */
  handleProcessingFailure(error) {
    console.error('[日记解析] 处理失败:', error);
    
    if (this.retryCount < this.maxRetries) {
      console.log('[日记解析] 准备重试...');
      this.restartListener();
    } else {
      console.error('[日记解析] 重试次数已用尽，停止监听');
      this.isTerminallyFailed = true;
      
      if (!this.hasShownFailureWarning) {
        this.hasShownFailureWarning = true;
        toastr.error('处理失败次数过多，请使用手动记录功能', '自动处理已停止');
      }
      
      this.stopListening();
    }
  }

  /**
   * 手动处理最新消息（记录功能）
   */
  async processLatestMessage() {
    try {
      console.log('[日记解析] 开始手动处理最新消息...');
      
      // 获取最新的AI消息
      const latestMessage = getLatestAIMessage();
      if (!latestMessage) {
        throw new Error('没有找到AI消息');
      }

      console.log('[日记解析] 找到最新AI消息:', latestMessage.mes.substring(0, 100) + '...');
      
      // 处理日记内容
      const success = await this.processDiaryMessage(latestMessage.mes);
      if (!success) {
        throw new Error('未找到有效的日记格式');
      }

      return true;
    } catch (error) {
      console.error('[日记解析] 手动处理失败:', error);
      throw error;
    }
  }

  /**
   * 验证日记内容格式
   */
  validateDiaryContent(title, time, content) {
    if (!title || title.trim() === '') {
      return false;
    }
    if (!time || time.trim() === '') {
      return false;
    }
    if (!content || content.trim() === '') {
      return false;
    }

    // 长度验证
    if (title.length > 100) {
      return false;
    }
    if (content.length > 5000) {
      return false;
    }

    return true;
  }

  /**
   * 获取监听状态
   */
  getListeningStatus() {
    return {
      isListening: this.isListening,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      isTerminallyFailed: this.isTerminallyFailed,
      hasCustomCharacter: !!this.customCharacterName,
      customCharacterName: this.customCharacterName
    };
  }
}
