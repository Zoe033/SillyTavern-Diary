/**
 * 日记本插件 - SillyTavern 原生插件版本
 * 
 * 功能：
 * - 智能日记写作：AI辅助生成格式化日记内容
 * - 预设自动切换：写日记时自动切换到专用预设
 * - 角色分类管理：按角色名称分类存储和浏览日记
 * - 完整的CRUD操作：创建、查看、删除日记条目
 * - 移动端优化：完整的响应式设计和移动端支持
 */

import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { eventSource, event_types } from "../../../../script.js";

// 插件基础配置
const extensionName = "日记本";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const worldbookName = "日记本";

// 插件设置结构
const defaultSettings = {
    selectedPreset: null,          // 用户选择的日记预设名
    lastUsedPreset: null,          // 写日记前的预设（临时存储）
    discoveredPresets: [],         // 发现的预设列表缓存
    lastPresetRefresh: 0,          // 上次刷新预设列表的时间戳
    worldbookName: worldbookName,  // 世界书名称
    isEnabled: true,               // 插件是否启用
    showMobileOptimizations: true, // 移动端优化开关
    autoDeleteMessages: true,      // 成功记录后自动删除消息
};

// 日记内容识别正则表达式
const DIARY_REGEX = /［日记标题：([^］]+)］[\s\S]*?［日记时间：([^］]+)］[\s\S]*?［日记内容：([\s\S]*?)］/g;

// 全局模块实例
let diaryStorage = null;
let presetManager = null; 
let diaryParser = null;
let diaryUI = null;
let characterDialog = null;

// 插件状态管理
let isInitialized = false;
let isListening = false;

/**
 * 加载插件设置
 */
async function loadSettings() {
    try {
        console.log('📚 [日记本] 加载插件设置...');
        
        // 创建设置对象如果不存在
        extension_settings[extensionName] = extension_settings[extensionName] || {};
        
        // 合并默认设置
        if (Object.keys(extension_settings[extensionName]).length === 0) {
            Object.assign(extension_settings[extensionName], defaultSettings);
            console.log('📚 [日记本] 应用默认设置');
        }

        // 更新UI中的设置控件
        updateSettingsUI();
        
        console.log('📚 [日记本] 设置加载完成:', extension_settings[extensionName]);
    } catch (error) {
        console.error('❌ [日记本] 设置加载失败:', error);
        toastr.error('日记本设置加载失败', '插件错误');
    }
}

/**
 * 更新设置UI
 */
function updateSettingsUI() {
    const settings = extension_settings[extensionName];
    
    // 更新各种设置控件的状态
    $("#diary_enabled").prop("checked", settings.isEnabled);
    $("#diary_mobile_optimizations").prop("checked", settings.showMobileOptimizations);
    $("#diary_auto_delete").prop("checked", settings.autoDeleteMessages);
    $("#diary_worldbook_name").val(settings.worldbookName);
    
    if (settings.selectedPreset) {
        $("#diary_selected_preset").val(settings.selectedPreset);
    }
}

/**
 * 设置项更改处理
 */
function onSettingChange(event) {
    const settingName = event.target.id.replace('diary_', '');
    const value = event.target.type === 'checkbox' ? 
                  event.target.checked : 
                  event.target.value;
    
    console.log(`📚 [日记本] 设置更改: ${settingName} = ${value}`);
    
    // 映射设置名称
    const settingMap = {
        'enabled': 'isEnabled',
        'mobile_optimizations': 'showMobileOptimizations', 
        'auto_delete': 'autoDeleteMessages',
        'worldbook_name': 'worldbookName',
        'selected_preset': 'selectedPreset'
    };
    
    const actualSettingName = settingMap[settingName] || settingName;
    extension_settings[extensionName][actualSettingName] = value;
    
    saveSettingsDebounced();
    
    // 特殊处理：世界书名称改变时需要重新初始化存储
    if (actualSettingName === 'worldbookName' && diaryStorage) {
        diaryStorage.updateWorldbookName(value);
    }
    
    toastr.info(`设置已更新: ${settingName}`, '日记本设置');
}

/**
 * 检测移动端设备
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
}

/**
 * 初始化功能模块
 */
async function initializeModules() {
    try {
        console.log('📚 [日记本] 开始初始化功能模块...');
        
        // 动态导入模块（这里先用占位符，稍后会实现具体模块）
        const { DiaryStorage } = await import('./modules/DiaryStorage.js');
        const { PresetManager } = await import('./modules/PresetManager.js');
        const { DiaryParser } = await import('./modules/DiaryParser.js');
        const { DiaryUI } = await import('./modules/DiaryUI.js');
        const { CharacterDialog } = await import('./modules/CharacterDialog.js');
        
        // 创建模块实例
        const settings = extension_settings[extensionName];
        
        diaryStorage = new DiaryStorage(settings.worldbookName);
        presetManager = new PresetManager(extensionName);
        diaryParser = new DiaryParser(diaryStorage, presetManager, settings);
        diaryUI = new DiaryUI(diaryStorage, presetManager, settings);
        characterDialog = new CharacterDialog();
        
        console.log('📚 [日记本] 模块初始化完成');
        return true;
    } catch (error) {
        console.error('❌ [日记本] 模块初始化失败:', error);
        toastr.error('日记本功能模块初始化失败，请检查插件安装', '插件错误');
        return false;
    }
}

/**
 * 设置事件监听
 */
function setupEventListeners() {
    console.log('📚 [日记本] 设置事件监听器...');
    
    // 消息事件监听（用于日记内容解析）
    eventSource.on(event_types.MESSAGE_RECEIVED, handleNewMessage);
    eventSource.on(event_types.MESSAGE_SENT, handleMessageSent);
    
    // 角色切换事件监听
    eventSource.on(event_types.CHARACTER_SELECTED, handleCharacterChange);
    
    // 页面卸载时的清理
    $(window).on('beforeunload', cleanup);
    
    console.log('📚 [日记本] 事件监听器设置完成');
}

/**
 * 处理新收到的消息
 */
async function handleNewMessage(data) {
    if (!isListening || !diaryParser) return;
    
    try {
        // 将消息传递给解析器处理
        await diaryParser.handleNewMessage(data);
    } catch (error) {
        console.error('❌ [日记本] 消息处理失败:', error);
    }
}

/**
 * 处理发送的消息
 */
async function handleMessageSent(data) {
    // 可以在这里处理用户发送的消息
    console.log('📚 [日记本] 消息已发送:', data);
}

/**
 * 处理角色切换
 */
function handleCharacterChange() {
    // 停止当前的监听状态
    if (isListening && diaryParser) {
        diaryParser.stopListening();
        isListening = false;
    }
}

/**
 * 日记本按钮点击处理
 */
async function handleDiaryBookClick() {
    try {
        console.log('📚 [日记本] 日记本按钮被点击');
        
        if (!diaryUI || !diaryStorage) {
            toastr.error('日记本功能未初始化', '错误');
            return;
        }
        
        // 加载所有日记数据
        const diariesData = await diaryStorage.getAllDiaries();
        
        // 显示日记界面
        diaryUI.showDiaryInterface(diariesData);
        
    } catch (error) {
        console.error('❌ [日记本] 打开日记本失败:', error);
        toastr.error('打开日记本失败，请稍后重试', '错误');
    }
}

/**
 * 写日记按钮点击处理
 */
async function handleWriteDiaryClick() {
    try {
        console.log('📚 [日记本] 写日记按钮被点击');
        
        if (!extension_settings[extensionName].isEnabled) {
            toastr.warning('日记本功能已禁用，请在设置中启用', '功能禁用');
            return;
        }
        
        if (!characterDialog || !diaryParser || !presetManager) {
            toastr.error('日记本功能未初始化', '错误');
            return;
        }
        
        // 显示角色选择对话框
        const currentCharName = getContext().name1 || '角色';
        const selectedCharacterName = await characterDialog.showDialog(currentCharName);
        
        if (selectedCharacterName === null) {
            console.log('📚 [日记本] 用户取消了写日记操作');
            return;
        }
        
        // 开始写日记流程
        await startWritingProcess(selectedCharacterName, currentCharName);
        
    } catch (error) {
        console.error('❌ [日记本] 写日记失败:', error);
        toastr.error('开始写日记失败，请稍后重试', '错误');
    }
}

/**
 * 开始写日记流程
 */
async function startWritingProcess(selectedCharacterName, currentCharName) {
    try {
        const finalCharacterName = selectedCharacterName || currentCharName;
        console.log(`📚 [日记本] 开始写日记流程，角色名: ${finalCharacterName}`);
        
        // 确保世界书存在
        await diaryStorage.ensureWorldbook();
        
        // 准备日记提示词
        const diaryPrompt = createDiaryPrompt(selectedCharacterName, currentCharName);
        
        // 准备预设切换
        const presetResult = await presetManager.prepareDiaryPreset();
        
        if (presetResult.success) {
            console.log('📚 [日记本] 预设切换成功');
        } else {
            console.warn('📚 [日记本] 预设切换失败，使用当前预设');
        }
        
        // 开始监听AI回复
        await diaryParser.startListening(finalCharacterName);
        isListening = true;
        
        // 发送日记提示词
        await sendDiaryPrompt(diaryPrompt);
        
        // 设置超时处理
        setTimeout(async () => {
            if (isListening) {
                await diaryParser.stopListening();
                isListening = false;
                toastr.warning('日记写作超时，请重新尝试', '超时提醒');
            }
        }, 180000); // 3分钟超时
        
    } catch (error) {
        console.error('❌ [日记本] 写日记流程失败:', error);
        throw error;
    }
}

/**
 * 创建日记提示词
 */
function createDiaryPrompt(selectedCharacterName, currentCharName) {
    if (selectedCharacterName && selectedCharacterName !== currentCharName) {
        return `以${selectedCharacterName}的口吻写一则日记，日记格式为：
［日记标题：{{标题}}］
［日记时间：{{时间}}］
［日记内容：{{内容}}］`;
    } else {
        return `以{{char}}的口吻写一则日记，日记格式为：
［日记标题：{{标题}}］
［日记时间：{{时间}}］
［日记内容：{{内容}}］`;
    }
}

/**
 * 发送日记提示词
 */
async function sendDiaryPrompt(prompt) {
    try {
        // 使用SillyTavern的发送消息功能
        const context = getContext();
        if (context.sendSystemMessage) {
            await context.sendSystemMessage(prompt);
        } else {
            // 备选方案：直接设置输入框并发送
            $('#send_textarea').val(prompt);
            $('#send_but').click();
        }
    } catch (error) {
        console.error('❌ [日记本] 发送提示词失败:', error);
        throw error;
    }
}

/**
 * 记录按钮点击处理（手动解析最新AI回复）
 */
async function handleRecordClick() {
    try {
        console.log('📚 [日记本] 记录按钮被点击');
        
        if (!diaryParser) {
            toastr.error('日记本功能未初始化', '错误');
            return;
        }
        
        // 手动解析最新的AI消息
        await diaryParser.recordLatestMessage();
        
    } catch (error) {
        console.error('❌ [日记本] 手动记录失败:', error);
        toastr.error('记录失败，请稍后重试', '错误');
    }
}

/**
 * 清理资源
 */
async function cleanup() {
    try {
        console.log('📚 [日记本] 开始清理资源...');
        
        // 停止监听
        if (isListening && diaryParser) {
            await diaryParser.stopListening();
            isListening = false;
        }
        
        // 清理UI
        if (diaryUI) {
            diaryUI.cleanup();
        }
        
        // 移除事件监听
        eventSource.removeListener(event_types.MESSAGE_RECEIVED, handleNewMessage);
        eventSource.removeListener(event_types.MESSAGE_SENT, handleMessageSent);
        eventSource.removeListener(event_types.CHARACTER_SELECTED, handleCharacterChange);
        
        console.log('📚 [日记本] 资源清理完成');
    } catch (error) {
        console.error('❌ [日记本] 资源清理失败:', error);
    }
}

/**
 * 插件主初始化函数
 */
jQuery(async () => {
    try {
        console.log('📚 [日记本] 开始初始化插件...');
        
        // 加载HTML模板
        const settingsHtml = await $.get(`${extensionFolderPath}/templates/settings.html`);
        const buttonsHtml = await $.get(`${extensionFolderPath}/templates/buttons.html`);
        
        // 添加设置面板到扩展设置
        $("#extensions_settings").append(settingsHtml);
        
        // 添加功能按钮到适当位置
        $("#top_bar").append(buttonsHtml);
        
        // 绑定事件处理器
        $("#diary_book_btn").on("click", handleDiaryBookClick);
        $("#diary_write_btn").on("click", handleWriteDiaryClick);
        $("#diary_record_btn").on("click", handleRecordClick);
        
        // 绑定设置变更事件
        $("#diary_enabled").on("change", onSettingChange);
        $("#diary_mobile_optimizations").on("change", onSettingChange);
        $("#diary_auto_delete").on("change", onSettingChange);
        $("#diary_worldbook_name").on("input", onSettingChange);
        $("#diary_selected_preset").on("change", onSettingChange);
        
        // 加载设置
        await loadSettings();
        
        // 初始化功能模块
        const moduleInitSuccess = await initializeModules();
        
        if (moduleInitSuccess) {
            // 设置事件监听
            setupEventListeners();
            
            isInitialized = true;
            console.log('✅ [日记本] 插件初始化完成');
            toastr.success('日记本插件加载成功', '插件已启用');
        } else {
            throw new Error('模块初始化失败');
        }
        
    } catch (error) {
        console.error('❌ [日记本] 插件初始化失败:', error);
        toastr.error('日记本插件初始化失败，请检查安装', '插件错误');
    }
});

// 导出主要函数供外部使用
window.DiaryPlugin = {
    handleDiaryBookClick,
    handleWriteDiaryClick,
    handleRecordClick,
    cleanup,
    getSettings: () => extension_settings[extensionName],
    isInitialized: () => isInitialized
};
