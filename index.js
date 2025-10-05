// 日记本插件 - SillyTavern插件
// 提供智能日记管理功能

// 导入SillyTavern核心功能
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, sendMessageAsUser, Generate, chat, name2 } from "../../../../script.js";
import { createNewWorldInfo, world_names, loadWorldInfo, saveWorldInfo, createWorldInfoEntry } from "../../../world-info.js";
import { executeSlashCommandsWithOptions } from "../../../slash-commands.js";
import { getPresetManager } from "../../../preset-manager.js";

// 插件基本配置
const extensionName = "SillyTavern-Diary";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// 主题配置（可扩展）
const THEMES = {
    classic: {
        id: 'classic',
        name: '经典',
        description: '基于2.3版本的古典书本风格，精致的皮革质感和华丽的装饰效果',
        cssFile: 'style-classic.css'
    },
    simple: {
        id: 'simple',
        name: '简洁',
        description: '现代简约设计，清爽的界面和流畅的交互体验',
        cssFile: 'style-simple.css'
    }
    // 未来可以在这里添加更多主题
    // future_theme: {
    //     id: 'future_theme',
    //     name: '未来主题名',
    //     description: '主题描述',
    //     cssFile: 'style-future-theme.css'
    // }
};

// 默认设置
const defaultSettings = {
    selectedPreset: null,          // 用户选择的日记预设
    selectedTheme: 'classic',      // 选中的主题（默认为经典主题）
    floatWindowVisible: true,      // 悬浮窗是否可见
    floatWindowPosition: {         // 悬浮窗位置
        x: 20,
        y: 100
    }
};

// 固定的世界书名称
const DIARY_WORLDBOOK_NAME = '日记本';

// 日记内容正则表达式
const DIARY_REGEX = /［日记标题：([^］]+)］[\s\S]*?［日记时间：([^］]+)］[\s\S]*?［日记内容：([\s\S]*?)］/g;

// 获取当前设置
function getCurrentSettings() {
    return extension_settings[extensionName] || {};
}

// 保存设置
function saveSettings() {
    saveSettingsDebounced();
}

// ===== 主题管理功能 =====

// 当前加载的主题CSS链接元素
let currentThemeLink = null;

// 加载主题CSS
function loadTheme(themeId) {
    console.log(`🎨 加载主题: ${themeId}`);
    
    const theme = THEMES[themeId];
    if (!theme) {
        console.error(`❌ 主题不存在: ${themeId}`);
        return;
    }
    
    // 移除旧的主题CSS
    if (currentThemeLink) {
        currentThemeLink.remove();
        currentThemeLink = null;
    }
    
    // 创建新的主题CSS链接
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = `${extensionFolderPath}/${theme.cssFile}`;
    link.id = 'diary-theme-css';
    
    // 添加到head
    document.head.appendChild(link);
    currentThemeLink = link;
    
    console.log(`✅ 主题CSS已加载: ${theme.name} (${theme.cssFile})`);
}

// 切换主题
function switchTheme(themeId) {
    console.log(`🎨 切换主题: ${themeId}`);
    
    const theme = THEMES[themeId];
    if (!theme) {
        console.error(`❌ 主题不存在: ${themeId}`);
        toastr.error('主题不存在', '主题切换');
        return;
    }
    
    // 加载新主题
    loadTheme(themeId);
    
    // 保存设置
    const settings = getCurrentSettings();
    settings.selectedTheme = themeId;
    saveSettings();
    
    // 更新UI
    updateThemeUI();
    
    toastr.success(`已切换到 ${theme.name} 主题`, '主题切换');
}

// 初始化主题选择器
function initThemeSelector() {
    const $select = $('#diary_theme_select');
    $select.empty();
    
    // 添加所有主题选项
    Object.values(THEMES).forEach(theme => {
        const option = $('<option>')
            .val(theme.id)
            .text(theme.name);
        $select.append(option);
    });
    
    // 设置当前选中的主题
    const settings = getCurrentSettings();
    const currentTheme = settings.selectedTheme || 'classic';
    $select.val(currentTheme);
    
    // 绑定切换事件
    $select.off('change').on('change', function() {
        const themeId = $(this).val();
        switchTheme(themeId);
    });
    
    console.log('✅ 主题选择器初始化完成');
}

// 更新主题UI显示
function updateThemeUI() {
    const settings = getCurrentSettings();
    const currentTheme = settings.selectedTheme || 'classic';
    const theme = THEMES[currentTheme];
    
    if (theme) {
        // 更新选择器
        $('#diary_theme_select').val(currentTheme);
        
        // 更新主题描述
        $('#diary_theme_description').text(theme.description);
    }
}

// 加载插件设置
async function loadSettings() {
    // 初始化设置
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    
    // 加载保存的主题（或使用默认主题）
    const settings = getCurrentSettings();
    const selectedTheme = settings.selectedTheme || 'classic';
    loadTheme(selectedTheme);
    console.log(`📖 已加载主题: ${THEMES[selectedTheme]?.name || selectedTheme}`);

    // 更新UI显示
    updateSettingsUI();
}

// 更新设置界面
function updateSettingsUI() {
    const settings = getCurrentSettings();
    
    // 初始化主题选择器
    initThemeSelector();
    
    // 更新主题UI
    updateThemeUI();
    
    // 更新各种设置控件的状态
    
    // 显示当前选择的预设
    if (settings.selectedPreset) {
        $("#diary_selected_preset").text(`当前预设: ${settings.selectedPreset}`);
    } else {
        $("#diary_selected_preset").text('未选择预设');
    }
}

// 打开日记本界面
async function openDiaryBook() {
    console.log('📖 打开日记本界面...');
    closeFloatMenu();
    
    // 显示日记本弹窗
    showDiaryBookDialog();
}

// 显示自定义角色选择弹窗
function showCustomCharacterDialog() {
    console.log('👤 显示自定义角色选择弹窗...');
    
    // 获取当前角色名称作为placeholder
    const currentCharacterName = getCurrentCharacterName();
    
    // 显示弹窗
    $('#diary-custom-character-dialog').show();
    $('#diary-character-input').attr('placeholder', currentCharacterName);
    $('#diary-character-input').val(''); // 清空输入框
    $('#diary-character-input').focus(); // 自动聚焦到输入框
}

// 隐藏自定义角色选择弹窗
function hideCustomCharacterDialog() {
    console.log('👤 隐藏自定义角色选择弹窗...');
    $('#diary-custom-character-dialog').hide();
}

// 继续写日记流程（从弹窗发送按钮调用）
async function continueWriteDiary() {
    console.log('✏️ 继续写日记流程...');
    
    // 获取用户输入的自定义角色名
    const customCharacterName = $('#diary-character-input').val().trim();
    console.log('👤 用户输入的角色名:', customCharacterName || '(空，使用默认角色名)');
    
    // 隐藏弹窗
    hideCustomCharacterDialog();
    
    // 预设切换：保存当前预设并切换到日记专用预设
    let originalPreset = null;
    let shouldRestorePreset = false;
    
    try {
        const result = await switchToDiaryPreset();
        originalPreset = result.originalPreset;
        shouldRestorePreset = result.switched;
    } catch (error) {
        console.error('⚠️ 预设切换失败，继续使用当前预设:', error);
    }
    
    try {
        // 第二步：发送日记命令给AI
        console.log('📝 发送日记命令给AI...');
        toastr.info('正在发送日记命令...', '写日记');
        
        // 确定最终使用的角色名
        const finalCharacterName = customCharacterName || getCurrentCharacterName();
        console.log('👤 最终使用的角色名:', finalCharacterName);
        
        // 构建日记提示词，根据用户输入决定是否替换{{char}}
        let diaryPrompt = '以{{char}}的口吻写一则日记，日记格式为：\n［日记标题：{{标题}}］\n［日记时间：{{时间}}］\n［日记内容：{{内容}}］';
        
        if (customCharacterName) {
            // 用户输入了自定义角色名，替换{{char}}
            diaryPrompt = diaryPrompt.replace(/\{\{char\}\}/g, customCharacterName);
            console.log('✅ 已将{{char}}替换为:', customCharacterName);
            toastr.info(`使用角色名：${customCharacterName}`, '写日记');
        } else {
            // 用户未输入，保持原始{{char}}模板
            console.log('✅ 保持原始{{char}}模板');
            toastr.info(`使用角色名：${finalCharacterName}`, '写日记');
        }
        
        // 发送用户消息
        await sendMessageAsUser(diaryPrompt, '');
        console.log('✅ 日记命令已发送');
        
        // 第三步：触发AI回复
        console.log('🤖 触发AI回复...');
        toastr.info('等待AI回复日记...', '写日记');
        
        try {
            await Generate('normal');
            console.log('✅ AI回复生成完成');
            
            // 预设恢复：等待10秒后恢复原预设
            if (shouldRestorePreset) {
                console.log('⏰ 10秒后将恢复原预设...');
                setTimeout(async () => {
                    await restoreOriginalPreset(originalPreset);
                }, 10000); // 10秒延时
            }
            
            // 第四步：解析日记内容
            console.log('🔍 开始解析最新消息中的日记内容...');
            toastr.info('正在解析日记内容...', '写日记');
            
            // 等待一小段时间确保消息已更新到chat数组
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const latestMessage = getLatestMessage();
            if (!latestMessage) {
                toastr.error('无法获取最新消息', '写日记错误');
                // 如果出错，立即恢复预设
                if (shouldRestorePreset) {
                    await restoreOriginalPreset(originalPreset);
                }
                return;
            }
            
            const diaryData = parseDiaryContent(latestMessage.mes);
            if (!diaryData) {
                toastr.error('未能解析出有效的日记内容', '写日记错误');
                // 如果出错，立即恢复预设
                if (shouldRestorePreset) {
                    await restoreOriginalPreset(originalPreset);
                }
                return;
            }
            
            console.log('✅ 日记内容解析完成:', diaryData);
            toastr.success(`成功解析日记："${diaryData.title}"`, '写日记');
            
            // 第五步：保存到世界书
            console.log('💾 开始保存日记到世界书...');
            toastr.info('正在保存日记到世界书...', '写日记');
            
            const saveSuccess = await saveDiaryToWorldbook(diaryData, finalCharacterName);
            if (!saveSuccess) {
                toastr.error('保存日记到世界书失败', '写日记错误');
                // 如果出错，立即恢复预设
                if (shouldRestorePreset) {
                    await restoreOriginalPreset(originalPreset);
                }
                return;
            }
            
            // 成功保存后自动删除最新两个楼层
            console.log('🗑️ 日记保存成功，开始自动删除楼层...');
            const deleteSuccess = await autoDeleteMessages();
            
            if (deleteSuccess) {
                console.log('🎉 写日记流程全部完成（包括自动删除楼层）！');
                toastr.success(`日记"${diaryData.title}"写作完成！已自动清理聊天记录`, '写日记', { timeOut: 5000 });
            } else {
                console.log('🎉 写日记流程完成（楼层删除失败或跳过）！');
                toastr.success(`日记"${diaryData.title}"写作完成！`, '写日记', { timeOut: 5000 });
            }
            
        } catch (error) {
            console.error('❌ AI回复生成失败:', error);
            toastr.error('AI回复生成失败，请重试', '写日记错误');
            // 如果出错，立即恢复预设
            if (shouldRestorePreset) {
                await restoreOriginalPreset(originalPreset);
            }
            return;
        }
        
    } catch (error) {
        console.error('❌ 写日记功能错误:', error);
        toastr.error(`写日记功能出错: ${error.message}`, '写日记错误');
        // 如果出错，立即恢复预设
        if (shouldRestorePreset) {
            await restoreOriginalPreset(originalPreset);
        }
    }
}

// 开始写日记（修改为先显示弹窗）
async function startWriteDiary() {
    console.log('✏️ 开始写日记...');
    closeFloatMenu();
    
    try {
        // 第一步：检查和创建日记本世界书
        const worldbookName = DIARY_WORLDBOOK_NAME;
        
        if (!world_names.includes(worldbookName)) {
            console.log(`📚 日记本世界书"${worldbookName}"不存在，正在创建...`);
            toastr.info(`正在创建世界书"${worldbookName}"...`, '写日记');
            
            const success = await createNewWorldInfo(worldbookName, { interactive: false });
            
            if (success === false) {
                console.error('❌ 创建日记本世界书失败');
                toastr.error('创建日记本世界书失败', '写日记错误');
                return;
            }
            
            console.log('✅ 日记本世界书创建成功');
            toastr.success(`世界书"${worldbookName}"创建成功`, '写日记');
        } else {
            console.log(`📚 日记本世界书"${worldbookName}"已存在，跳过创建步骤`);
        }
        
        // 第二步：显示自定义角色选择弹窗
        showCustomCharacterDialog();
        
    } catch (error) {
        console.error('❌ 写日记功能错误:', error);
        toastr.error(`写日记功能出错: ${error.message}`, '写日记错误');
    }
}

// 记录日记内容
async function recordDiary() {
    console.log('📝 记录日记内容...');
    closeFloatMenu();
    
    try {
        // 第一步：检查和创建日记本世界书
        const worldbookName = DIARY_WORLDBOOK_NAME;
        
        if (!world_names.includes(worldbookName)) {
            console.log(`📚 日记本世界书"${worldbookName}"不存在，正在创建...`);
            toastr.info(`正在创建世界书"${worldbookName}"...`, '记录');
            
            const success = await createNewWorldInfo(worldbookName, { interactive: false });
            
            if (success === false) {
                console.error('❌ 创建日记本世界书失败');
                toastr.error('创建日记本世界书失败', '记录错误');
                return;
            }
            
            console.log('✅ 日记本世界书创建成功');
            toastr.success(`世界书"${worldbookName}"创建成功`, '记录');
        } else {
            console.log(`📚 日记本世界书"${worldbookName}"已存在，跳过创建步骤`);
        }
        
        // 第二步：获取最新消息
        console.log('📨 获取最新消息...');
        toastr.info('正在获取最新消息...', '记录');
        
        const latestMessage = getLatestMessage();
        if (!latestMessage) {
            toastr.error('无法获取最新消息', '记录错误');
            return;
        }
        
        // 第三步：解析日记内容
        console.log('🔍 解析消息中的日记内容...');
        toastr.info('正在解析日记内容...', '记录');
        
        const diaryData = parseDiaryContent(latestMessage.mes);
        if (!diaryData) {
            toastr.error('未能在最新消息中找到有效的日记内容', '记录错误');
            return;
        }
        
        console.log('✅ 日记内容解析成功:', diaryData);
        toastr.success(`成功解析日记："${diaryData.title}"`, '记录');
        
        // 第四步：保存到世界书
        console.log('💾 保存日记到世界书...');
        toastr.info('正在保存日记到世界书...', '记录');
        
        const saveSuccess = await saveDiaryToWorldbook(diaryData);
        if (!saveSuccess) {
            toastr.error('保存日记到世界书失败', '记录错误');
            return;
        }
        
        // 成功保存后自动删除最新两个楼层
        console.log('🗑️ 日记保存成功，开始自动删除楼层...');
        const deleteSuccess = await autoDeleteMessages();
        
        if (deleteSuccess) {
            console.log('🎉 记录日记流程完成（包括自动删除楼层）！');
            toastr.success(`日记"${diaryData.title}"记录完成！已自动清理聊天记录`, '记录', { timeOut: 5000 });
        } else {
            console.log('🎉 记录日记流程完成（楼层删除失败或跳过）！');
            toastr.success(`日记"${diaryData.title}"记录完成！`, '记录', { timeOut: 5000 });
        }
        
    } catch (error) {
        console.error('❌ 记录日记功能错误:', error);
        toastr.error(`记录日记出错: ${error.message}`, '记录错误');
    }
}

// 预设配置
async function configurePresets() {
    console.log('⚙️ 打开预设配置界面...');
    showPresetDialog();
}

// 检测移动端设备
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768 || 
           ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0);
}

// 显示插件状态
function showPluginStatus() {
    const settings = getCurrentSettings();
    console.log('📊 日记本插件状态:', {
        世界书名称: DIARY_WORLDBOOK_NAME,
        当前预设: settings.selectedPreset || '未配置',
        悬浮窗可见: settings.floatWindowVisible,
        悬浮窗位置: settings.floatWindowPosition,
        移动端环境: isMobileDevice()
    });
}

// 获取最新的聊天消息
function getLatestMessage() {
    try {
        if (!chat || chat.length === 0) {
            console.warn('⚠️ 聊天记录为空');
            return null;
        }
        
        const latestMessage = chat[chat.length - 1];
        console.log('📨 获取到最新消息:', {
            index: chat.length - 1,
            content: latestMessage.mes ? latestMessage.mes.substring(0, 100) + '...' : '无内容',
            name: latestMessage.name || '未知发送者'
        });
        
        return latestMessage;
        
    } catch (error) {
        console.error('❌ 获取最新消息失败:', error);
        return null;
    }
}

// 解析日记内容
function parseDiaryContent(messageContent) {
    try {
        if (!messageContent || typeof messageContent !== 'string') {
            console.warn('⚠️ 消息内容为空或不是字符串');
            return null;
        }
        
        console.log('🔍 开始解析日记内容...');
        console.log('📝 原始消息内容:', messageContent.substring(0, 200) + '...');
        
        // 重置正则表达式的lastIndex
        DIARY_REGEX.lastIndex = 0;
        
        const matches = DIARY_REGEX.exec(messageContent);
        
        if (!matches) {
            console.log('❌ 未找到符合格式的日记内容');
            return null;
        }
        
        const title = matches[1]?.trim();
        const time = matches[2]?.trim();
        const content = matches[3]?.trim();
        
        console.log('🎯 解析到的日记内容:', {
            标题: title,
            时间: time,
            内容长度: content?.length || 0
        });
        
        // 检查是否是模板内容，跳过保存
        if (title === '{{标题}}' || time === '{{时间}}' || content === '{{内容}}') {
            console.log('⚠️ 检测到模板内容，跳过保存');
            toastr.warning('检测到模板格式内容，请让AI生成真实的日记内容', '日记解析');
            return null;
        }
        
        // 验证内容有效性
        if (!title || !time || !content) {
            console.log('❌ 日记内容不完整:', { title, time, content });
            toastr.warning('日记内容不完整，请检查格式', '日记解析');
            return null;
        }
        
        console.log('✅ 日记内容解析成功');
        return {
            title,
            time,
            content
        };
        
    } catch (error) {
        console.error('❌ 解析日记内容失败:', error);
        return null;
    }
}

// 获取当前角色名称
function getCurrentCharacterName() {
    try {
        // 优先使用name2（当前角色名称）
        if (name2 && typeof name2 === 'string' && name2.trim() !== '') {
            console.log('📝 使用name2获取角色名称:', name2);
            return name2.trim();
        }
        
        // 备用方法：通过getContext获取
        const context = getContext();
        if (context && context.name2) {
            console.log('📝 通过context获取角色名称:', context.name2);
            return context.name2.trim();
        }
        
        console.warn('⚠️ 无法获取角色名称，使用默认值');
        return 'Unknown';
        
    } catch (error) {
        console.error('❌ 获取角色名称失败:', error);
        return 'Unknown';
    }
}

// 自动删除最新两个楼层
async function autoDeleteMessages() {
    try {
        // 自动删除功能始终启用
        
        console.log('🗑️ 开始自动删除最新两个楼层...');
        
        // 记录删除前的楼层数量
        const messageCountBefore = chat ? chat.length : 0;
        console.log(`📊 删除前楼层数量: ${messageCountBefore}`);
        
        if (messageCountBefore < 2) {
            console.log('⚠️ 楼层数量不足2个，跳过删除');
            return false;
        }
        
        // 执行删除命令
        console.log('🔧 执行删除命令: /del 2');
        await executeSlashCommandsWithOptions('/del 2', {
            handleExecutionErrors: true,
            handleParserErrors: true,
            abortController: null
        });
        
        // 等待命令执行完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 检查删除后的楼层数量
        const messageCountAfter = chat ? chat.length : 0;
        console.log(`📊 删除后楼层数量: ${messageCountAfter}`);
        
        const deletedCount = messageCountBefore - messageCountAfter;
        
        if (deletedCount >= 2) {
            console.log(`✅ 成功删除 ${deletedCount} 个楼层`);
            toastr.success(`已自动删除 ${deletedCount} 个聊天楼层`, '自动删除');
            return true;
        } else if (deletedCount > 0) {
            console.log(`⚠️ 只删除了 ${deletedCount} 个楼层，少于预期的2个`);
            toastr.warning(`只删除了 ${deletedCount} 个楼层`, '自动删除');
            return false;
        } else {
            console.log('❌ 删除失败，楼层数量未变化');
            toastr.error('自动删除楼层失败', '自动删除错误');
            return false;
        }
        
    } catch (error) {
        console.error('❌ 自动删除楼层失败:', error);
        toastr.error(`自动删除楼层失败: ${error.message}`, '自动删除错误');
        return false;
    }
}

// 保存日记到世界书
async function saveDiaryToWorldbook(diaryData, characterName = null) {
    try {
        console.log('💾 开始保存日记到世界书...');
        
        const worldbookName = DIARY_WORLDBOOK_NAME;
        
        // 如果没有传入角色名，则使用默认的角色卡名称
        const finalCharacterName = characterName || getCurrentCharacterName();
        console.log('👤 保存日记使用的角色名:', finalCharacterName);
        
        // 加载世界书数据
        console.log(`📚 加载世界书数据: ${worldbookName}`);
        const worldData = await loadWorldInfo(worldbookName);
        
        if (!worldData || !worldData.entries) {
            console.error('❌ 无法加载世界书数据');
            toastr.error('无法加载世界书数据', '保存日记错误');
            return false;
        }
        
        // 创建新的世界书条目
        console.log('📝 创建新的日记条目...');
        const newEntry = createWorldInfoEntry(worldbookName, worldData);
        
        if (!newEntry) {
            console.error('❌ 无法创建世界书条目');
            toastr.error('无法创建世界书条目', '保存日记错误');
            return false;
        }
        
        // 设置条目内容
        const entryName = `${diaryData.title}-${diaryData.time}`;
        
        // 设置条目属性
        newEntry.comment = entryName; // 条目名称
        newEntry.key = [finalCharacterName]; // 关键词：角色目录名
        newEntry.content = diaryData.content; // 条目内容：日记内容
        newEntry.enabled = true; // 启用条目
        
        console.log('📋 日记条目信息:', {
            UID: newEntry.uid,
            条目名称: entryName,
            关键词: finalCharacterName,
            内容长度: diaryData.content.length
        });
        
        // 保存世界书
        console.log('💾 保存世界书数据...');
        await saveWorldInfo(worldbookName, worldData);
        
        console.log('✅ 日记保存成功');
        toastr.success(`日记"${diaryData.title}"已保存到世界书`, '保存日记');
        
        return true;
        
    } catch (error) {
        console.error('❌ 保存日记到世界书失败:', error);
        toastr.error(`保存日记失败: ${error.message}`, '保存日记错误');
        return false;
    }
}

// ===== 悬浮窗功能 =====

// 悬浮窗状态管理
let floatWindow = {
    element: null,
    isExpanded: false,
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    startPos: { x: 0, y: 0 },
    hasMoved: false,
    lastClickTime: 0  // 防止重复触发
};

// 初始化悬浮窗（将HTML移动到body）
function createFloatWindow() {
    // 将悬浮窗从设置面板移动到body
    $('#diary-float-window').appendTo('body');
    floatWindow.element = $('#diary-float-window');
    
    // 设置初始位置
    resetFloatWindowPosition();
    
    // 绑定悬浮窗事件
    bindFloatWindowEvents();
    
    console.log('✅ 悬浮窗已初始化');
}

// 绑定悬浮窗事件
function bindFloatWindowEvents() {
    const $mainBtn = $('#diary-float-main-btn');
    const $menu = $('#diary-float-menu');
    const $window = $('#diary-float-window');
    
    // 主按钮点击事件 - 展开/收起菜单
    // 同时监听 click 和 touchend 事件，确保移动端也能响应
    $mainBtn.on('click touchend', function(e) {
        // 如果是 touchend 并且正在拖拽，不处理
        if (e.type === 'touchend' && floatWindow.isDragging) {
            return;
        }
        
        // 防止短时间内重复触发（移动端 touchend 和 click 可能都触发）
        const now = Date.now();
        if (now - floatWindow.lastClickTime < 300) {
            console.log('🚫 防止重复触发');
            return;
        }
        floatWindow.lastClickTime = now;
        
        e.preventDefault();
        e.stopPropagation();
        
        // 如果刚刚发生了拖拽，不触发菜单切换
        if (floatWindow.hasMoved) {
            console.log('🚫 检测到拖拽，取消菜单切换');
            return;
        }
        
        console.log('👆 点击悬浮窗，切换菜单状态');
        toggleFloatMenu();
    });
    
    // 子按钮点击事件
    $('#diary-float-book-btn').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openDiaryBook();
        closeFloatMenu();
    });
    
    $('#diary-float-write-btn').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        startWriteDiary();
        closeFloatMenu();
    });
    
    $('#diary-float-record-btn').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        recordDiary();
        closeFloatMenu();
    });
    
    // 拖拽功能
    $mainBtn.on('mousedown touchstart', function(e) {
        if (floatWindow.isExpanded) return; // 菜单展开时不允许拖拽
        
        floatWindow.isDragging = true;
        floatWindow.hasMoved = false;
        
        const clientX = e.originalEvent.clientX || e.originalEvent.touches[0].clientX;
        const clientY = e.originalEvent.clientY || e.originalEvent.touches[0].clientY;
        const rect = $window[0].getBoundingClientRect();
        
        // 记录拖拽偏移量和起始位置
        floatWindow.dragOffset = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
        
        floatWindow.startPos = {
            x: clientX,
            y: clientY
        };
        
        // 只在桌面端阻止默认行为，移动端需要等待确认是否真的拖拽
        if (e.type === 'mousedown') {
            e.preventDefault();
        }
    });
    
    // 全局鼠标移动事件
    $(document).on('mousemove touchmove', function(e) {
        if (!floatWindow.isDragging) return;
        
        const clientX = e.originalEvent.clientX || e.originalEvent.touches[0].clientX;
        const clientY = e.originalEvent.clientY || e.originalEvent.touches[0].clientY;
        
        // 检查是否移动了足够距离
        // 移动端需要更大的阈值（15px），桌面端5px
        const moveThreshold = e.type === 'touchmove' ? 15 : 5;
        const moveDistance = Math.sqrt(
            Math.pow(clientX - floatWindow.startPos.x, 2) + 
            Math.pow(clientY - floatWindow.startPos.y, 2)
        );
        
        if (moveDistance > moveThreshold) {
            floatWindow.hasMoved = true;
            // 移动端在确认拖拽后才阻止默认行为
            if (e.type === 'touchmove') {
                e.preventDefault();
            }
        }
        
        let newX = clientX - floatWindow.dragOffset.x;
        let newY = clientY - floatWindow.dragOffset.y;
        
        // 边界限制
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const elementWidth = $window.outerWidth();
        const elementHeight = $window.outerHeight();
        
        newX = Math.max(0, Math.min(newX, windowWidth - elementWidth));
        newY = Math.max(0, Math.min(newY, windowHeight - elementHeight));
        
        $window.css({
            left: newX + 'px',
            top: newY + 'px'
        });
        
        e.preventDefault();
    });
    
    // 全局鼠标释放事件
    $(document).on('mouseup touchend', function(e) {
        if (floatWindow.isDragging) {
            floatWindow.isDragging = false;
            
            // 只有在真正移动了的情况下才保存位置
            if (floatWindow.hasMoved) {
                saveFloatWindowPosition();
                
                // 移动端：延迟重置 hasMoved 标志，避免立即触发点击
                if (e.type === 'touchend') {
                    setTimeout(() => {
                        floatWindow.hasMoved = false;
                    }, 300);
                }
            } else {
                // 没有移动，立即重置标志，允许点击事件触发
                floatWindow.hasMoved = false;
            }
        }
    });
    
    // 点击外部区域关闭菜单
    $(document).on('click', function(e) {
        if (!$(e.target).closest('#diary-float-window').length && floatWindow.isExpanded) {
            closeFloatMenu();
        }
    });
}

// 切换悬浮菜单显示状态
function toggleFloatMenu() {
    if (floatWindow.isExpanded) {
        closeFloatMenu();
    } else {
        openFloatMenu();
    }
}

// 打开悬浮菜单
function openFloatMenu() {
    $('#diary-float-menu').show();
    $('#diary-float-main-btn').addClass('diary-float-expanded');
    floatWindow.isExpanded = true;
}

// 关闭悬浮菜单
function closeFloatMenu() {
    $('#diary-float-menu').hide();
    $('#diary-float-main-btn').removeClass('diary-float-expanded');
    floatWindow.isExpanded = false;
}

// 显示/隐藏悬浮窗
function toggleFloatWindow() {
    const settings = getCurrentSettings();
    const newState = !settings.floatWindowVisible;
    
    extension_settings[extensionName].floatWindowVisible = newState;
    saveSettings();
    
    if (newState) {
        $('#diary-float-window').show();
        toastr.info('悬浮窗已显示', '日记本');
    } else {
        $('#diary-float-window').hide();
        closeFloatMenu();
        toastr.info('悬浮窗已隐藏', '日记本');
    }
}

// 重置悬浮窗位置
function resetFloatWindowPosition() {
    const settings = getCurrentSettings();
    const position = settings.floatWindowPosition || defaultSettings.floatWindowPosition;
    
    if (floatWindow.element) {
        floatWindow.element.css({
            left: position.x + 'px',
            top: position.y + 'px'
        });
    }
    
    toastr.info('悬浮窗位置已重置', '日记本');
}

// 保存悬浮窗位置
function saveFloatWindowPosition() {
    if (!floatWindow.element) return;
    
    const position = {
        x: parseInt(floatWindow.element.css('left')),
        y: parseInt(floatWindow.element.css('top'))
    };
    
    extension_settings[extensionName].floatWindowPosition = position;
    saveSettings();
}

// ===== 自定义角色弹窗功能 =====

// 初始化自定义角色选择弹窗（将HTML移动到body）
function createCustomCharacterDialog() {
    console.log('👤 初始化自定义角色选择弹窗...');
    
    // 将弹窗从设置面板移动到body
    $('#diary-custom-character-dialog').appendTo('body');
    
    console.log('✅ 自定义角色选择弹窗已初始化');
}

// 绑定自定义角色弹窗事件
function bindCustomCharacterDialogEvents() {
    console.log('👤 绑定自定义角色弹窗事件...');
    
    // 发送按钮点击事件
    $(document).on('click', '#diary-character-send-btn', async function(e) {
        e.preventDefault();
        console.log('✅ 点击发送按钮，继续写日记流程');
        
        // 继续写日记流程
        await continueWriteDiary();
    });
    
    // 取消按钮点击事件
    $(document).on('click', '#diary-character-cancel-btn', function(e) {
        e.preventDefault();
        console.log('❌ 点击取消按钮，中断写日记流程');
        
        // 隐藏弹窗
        hideCustomCharacterDialog();
        
        // 显示取消提示
        toastr.info('已取消写日记', '写日记');
    });
    
    // 关闭按钮点击事件
    $(document).on('click', '#diary-character-close-btn', function(e) {
        e.preventDefault();
        console.log('❌ 点击关闭按钮，中断写日记流程');
        
        // 隐藏弹窗
        hideCustomCharacterDialog();
        
        // 显示取消提示
        toastr.info('已取消写日记', '写日记');
    });
    
    // 点击弹窗外部区域关闭
    $(document).on('click', '#diary-custom-character-dialog', function(e) {
        if (e.target === this) {
            console.log('❌ 点击外部区域，中断写日记流程');
            
            // 隐藏弹窗
            hideCustomCharacterDialog();
            
            // 显示取消提示
            toastr.info('已取消写日记', '写日记');
        }
    });
    
    // 回车键发送
    $(document).on('keypress', '#diary-character-input', async function(e) {
        if (e.which === 13) { // Enter键
            e.preventDefault();
            console.log('⌨️ 按下回车键，继续写日记流程');
            
            // 继续写日记流程
            await continueWriteDiary();
        }
    });
    
    // ESC键取消
    $(document).on('keydown', function(e) {
        if (e.keyCode === 27 && $('#diary-custom-character-dialog').is(':visible')) { // ESC键
            console.log('⌨️ 按下ESC键，中断写日记流程');
            
            // 隐藏弹窗
            hideCustomCharacterDialog();
            
            // 显示取消提示
            toastr.info('已取消写日记', '写日记');
        }
    });
    
    console.log('✅ 自定义角色弹窗事件绑定完成');
}

// ===== 日记本弹窗功能 =====

// 通用视图切换函数
function switchDiaryBookView(targetViewId) {
    console.log(`🔄 切换到视图: ${targetViewId}`);
    
    // 隐藏所有视图
    const allViews = ['#diary-book-cover-view', '#diary-book-character-list-view', '#diary-book-diary-list-view', '#diary-book-detail-view'];
    allViews.forEach(viewId => {
        $(viewId).hide();
        console.log(`🔄 隐藏视图: ${viewId}, 状态: ${$(viewId).is(':visible')}`);
    });
    
    // 显示目标视图
    $(targetViewId).css('display', 'block').show();
    
    // 验证视图状态
    allViews.forEach(viewId => {
        const isVisible = $(viewId).is(':visible');
        const displayStyle = $(viewId).css('display');
        console.log(`🔍 视图${viewId}: 可见=${isVisible}, display=${displayStyle}`);
    });
    
    console.log(`✅ 视图切换完成，当前活动视图: ${targetViewId}`);
}

// ==================== 预设管理功能 ====================

// 预设列表状态
const presetListState = {
    presets: [],
    currentPreset: '',      // 系统当前使用的预设
    selectedPreset: null,   // 用户选择的日记专用预设
    currentPage: 1,
    pageSize: 8,
    totalPages: 1
};

// 显示预设列表弹窗
function showPresetDialog() {
    console.log('⚙️ 显示预设列表弹窗...');
    $('#diary-preset-dialog').show();
    loadPresetData();
    renderPresetList();
}

// 隐藏预设列表弹窗
function hidePresetDialog() {
    console.log('⚙️ 隐藏预设列表弹窗...');
    $('#diary-preset-dialog').hide();
}

// 加载预设数据
async function loadPresetData() {
    try {
        console.log('📚 从预设管理器加载预设数据...');
        
        const presetManager = getPresetManager();
        
        if (!presetManager) {
            console.log('❌ 预设管理器不可用');
            presetListState.presets = [];
            presetListState.currentPreset = '未选择预设';
            presetListState.selectedPreset = null;
            return;
        }
        
        // 获取所有预设
        const allPresets = presetManager.getAllPresets();
        console.log('📊 获取到的预设列表:', allPresets);
        
        // 获取当前选中的预设（系统当前使用的预设）
        const currentPreset = presetManager.getSelectedPresetName();
        console.log('📊 系统当前预设:', currentPreset);
        
        // 获取用户保存的日记专用预设
        const savedPreset = extension_settings[extensionName]?.selectedPreset;
        console.log('📊 用户选择的日记预设:', savedPreset);
        
        // 更新状态
        presetListState.presets = allPresets || [];
        presetListState.currentPreset = currentPreset || '未选择预设';
        presetListState.selectedPreset = savedPreset || null;
        presetListState.totalPages = Math.max(1, Math.ceil(presetListState.presets.length / presetListState.pageSize));
        presetListState.currentPage = 1;
        
        // 更新设置页面显示
        updatePresetDisplayText();
        
        console.log(`✅ 加载完成: ${presetListState.presets.length}个预设, 系统当前: ${presetListState.currentPreset}, 日记预设: ${presetListState.selectedPreset || '未设置'}`);
    } catch (error) {
        console.error('❌ 加载预设数据失败:', error);
        presetListState.presets = [];
        presetListState.currentPreset = '加载失败';
        presetListState.selectedPreset = null;
        toastr.error('加载预设列表失败', '预设管理');
    }
}

// 更新设置页面的预设显示文本
function updatePresetDisplayText() {
    const displayText = presetListState.selectedPreset 
        ? `日记预设: ${presetListState.selectedPreset}` 
        : '未选择日记预设（将使用系统当前预设）';
    $('#diary_selected_preset').text(displayText);
}

// 渲染预设列表
function renderPresetList() {
    console.log(`🎨 渲染预设列表 (第${presetListState.currentPage}页/${presetListState.totalPages}页)...`);
    
    const $grid = $('#diary-preset-grid');
    const $empty = $('#diary-preset-empty');
    const $systemPreset = $('#diary-preset-system-name');
    const $selectedPreset = $('#diary-preset-selected-name');
    
    // 更新系统当前预设和日记选中预设显示
    $systemPreset.text(presetListState.currentPreset);
    $selectedPreset.text(presetListState.selectedPreset || '未设置（将使用系统预设）');
    
    // 清空列表
    $grid.empty();
    
    if (presetListState.presets.length === 0) {
        $grid.hide();
        $empty.show();
        updatePresetPagination();
        return;
    }
    
    $empty.hide();
    $grid.show();
    
    const startIndex = (presetListState.currentPage - 1) * presetListState.pageSize;
    const endIndex = Math.min(startIndex + presetListState.pageSize, presetListState.presets.length);
    const currentPagePresets = presetListState.presets.slice(startIndex, endIndex);
    
    currentPagePresets.forEach((presetName, index) => {
        const presetCard = createPresetCard(presetName, startIndex + index);
        $grid.append(presetCard);
        console.log(`⚙️ 添加预设卡片 ${index + 1}: ${presetName}`);
    });
    
    updatePresetPagination();
    console.log(`✅ 渲染完成: 显示${currentPagePresets.length}个预设`);
}

// 创建预设卡片
function createPresetCard(presetName, index) {
    const isSystemCurrent = presetName === presetListState.currentPreset;
    const isSelected = presetName === presetListState.selectedPreset;
    
    // 样式类
    let cardClasses = 'diary-preset-item';
    if (isSelected) {
        cardClasses += ' diary-preset-item-selected';
    } else if (isSystemCurrent) {
        cardClasses += ' diary-preset-item-current';
    }
    
    // 徽章
    let badges = '';
    if (isSystemCurrent) {
        badges += '<span class="diary-preset-badge diary-preset-badge-current">系统当前</span>';
    }
    if (isSelected) {
        badges += '<span class="diary-preset-badge diary-preset-badge-selected">✓ 已选择</span>';
    }
    
    return `
        <div class="${cardClasses}" data-preset-name="${presetName}">
            <div class="diary-preset-item-info">
                <div class="diary-preset-item-name">${presetName}</div>
            </div>
            ${badges}
        </div>
    `;
}

// 更新预设列表分页信息
function updatePresetPagination() {
    const $pageInfo = $('#diary-preset-page-info');
    const $prevBtn = $('#diary-preset-prev-page');
    const $nextBtn = $('#diary-preset-next-page');
    
    $pageInfo.text(`第 ${presetListState.currentPage} 页，共 ${presetListState.totalPages} 页`);
    
    $prevBtn.prop('disabled', presetListState.currentPage === 1);
    $nextBtn.prop('disabled', presetListState.currentPage === presetListState.totalPages);
}

// 选择预设
async function selectPresetForDiary(presetName) {
    try {
        console.log(`📌 选择日记预设: ${presetName}`);
        
        // 更新状态
        presetListState.selectedPreset = presetName;
        
        // 保存到设置
        extension_settings[extensionName].selectedPreset = presetName;
        saveSettingsDebounced();
        
        // 更新显示
        updatePresetDisplayText();
        renderPresetList();
        
        // 提示用户
        toastr.success(`已选择预设: ${presetName}`, '预设设置');
        
        console.log(`✅ 预设选择已保存: ${presetName}`);
    } catch (error) {
        console.error('❌ 保存预设选择失败:', error);
        toastr.error('保存预设设置失败', '预设管理');
    }
}

// 取消选择预设（使用系统当前预设）
async function unselectPresetForDiary() {
    try {
        console.log('🔄 取消日记预设选择，将使用系统当前预设');
        
        // 更新状态
        presetListState.selectedPreset = null;
        
        // 保存到设置
        extension_settings[extensionName].selectedPreset = null;
        saveSettingsDebounced();
        
        // 更新显示
        updatePresetDisplayText();
        renderPresetList();
        
        // 提示用户
        toastr.info('已取消选择，写日记时将使用系统当前预设', '预设设置');
        
        console.log('✅ 已重置为使用系统当前预设');
    } catch (error) {
        console.error('❌ 重置预设设置失败:', error);
        toastr.error('重置预设设置失败', '预设管理');
    }
}

// 切换到日记专用预设
async function switchToDiaryPreset() {
    const result = {
        switched: false,
        originalPreset: null
    };
    
    try {
        // 检查是否设置了日记专用预设
        const diaryPresetName = extension_settings[extensionName]?.selectedPreset;
        
        if (!diaryPresetName) {
            console.log('ℹ️ 未设置日记专用预设，使用系统当前预设');
            return result;
        }
        
        // 获取预设管理器
        const presetManager = getPresetManager();
        if (!presetManager) {
            console.log('⚠️ 预设管理器不可用');
            return result;
        }
        
        // 保存当前预设
        const currentPresetName = presetManager.getSelectedPresetName();
        console.log(`💾 当前预设: ${currentPresetName}`);
        
        // 检查是否已经是目标预设
        if (currentPresetName === diaryPresetName) {
            console.log(`ℹ️ 已经是目标预设: ${diaryPresetName}，无需切换`);
            return result;
        }
        
        // 查找日记预设的值
        const diaryPresetValue = presetManager.findPreset(diaryPresetName);
        if (!diaryPresetValue) {
            console.log(`⚠️ 未找到日记预设: ${diaryPresetName}`);
            toastr.warning(`预设"${diaryPresetName}"不存在，使用当前预设`, '预设切换');
            return result;
        }
        
        // 切换到日记预设
        console.log(`🔄 切换预设: ${currentPresetName} → ${diaryPresetName}`);
        presetManager.selectPreset(diaryPresetValue);
        
        toastr.success(`已切换到日记预设: ${diaryPresetName}`, '预设切换', { timeOut: 2000 });
        
        // 更新结果
        result.switched = true;
        result.originalPreset = currentPresetName;
        
        console.log(`✅ 预设切换成功，将在10秒后恢复到: ${currentPresetName}`);
        
    } catch (error) {
        console.error('❌ 切换到日记预设失败:', error);
        toastr.error('预设切换失败，使用当前预设', '预设切换');
    }
    
    return result;
}

// 恢复原预设
async function restoreOriginalPreset(originalPresetName) {
    try {
        if (!originalPresetName) {
            console.log('ℹ️ 无需恢复预设');
            return;
        }
        
        // 获取预设管理器
        const presetManager = getPresetManager();
        if (!presetManager) {
            console.log('⚠️ 预设管理器不可用，无法恢复预设');
            return;
        }
        
        // 查找原预设的值
        const originalPresetValue = presetManager.findPreset(originalPresetName);
        if (!originalPresetValue) {
            console.log(`⚠️ 未找到原预设: ${originalPresetName}`);
            return;
        }
        
        // 恢复原预设
        const currentPresetName = presetManager.getSelectedPresetName();
        console.log(`🔄 恢复预设: ${currentPresetName} → ${originalPresetName}`);
        
        presetManager.selectPreset(originalPresetValue);
        
        toastr.info(`已恢复原预设: ${originalPresetName}`, '预设恢复', { timeOut: 2000 });
        console.log(`✅ 预设已恢复: ${originalPresetName}`);
        
    } catch (error) {
        console.error('❌ 恢复原预设失败:', error);
        toastr.warning('预设恢复失败', '预设恢复');
    }
}

// ==================== 日记本浏览界面 ====================

// 显示日记本弹窗
function showDiaryBookDialog() {
    console.log('📖 显示日记本弹窗...');
    
    // 显示弹窗
    $('#diary-book-dialog').show();
    
    // 显示封面视图
    showDiaryBookCover();
}

// 隐藏日记本弹窗
function hideDiaryBookDialog() {
    console.log('📖 隐藏日记本弹窗...');
    $('#diary-book-dialog').hide();
}

// 显示日记本封面
function showDiaryBookCover() {
    console.log('📖 显示日记本封面...');
    
    // 使用通用视图切换
    switchDiaryBookView('#diary-book-cover-view');
    
    // 更新封面信息
    updateDiaryBookCover();
}

// 更新日记本封面信息
async function updateDiaryBookCover() {
    try {
        console.log('📖 更新日记本封面信息...');
        
        // 检查世界书是否存在
        const worldbookName = DIARY_WORLDBOOK_NAME;
        if (!world_names.includes(worldbookName)) {
            // 世界书不存在，显示空状态
            $('#diary-book-total-count').text('0');
            $('#diary-book-character-count').text('0');
            return;
        }
        
        // 加载世界书数据
        const worldData = await loadWorldInfo(worldbookName);
        if (!worldData || !worldData.entries) {
            $('#diary-book-total-count').text('0');
            $('#diary-book-character-count').text('0');
            return;
        }
        
        // 统计日记数量和角色数量
        const entries = Object.values(worldData.entries);
        const totalDiaries = entries.length;
        
        // 统计不同角色的数量
        const characters = new Set();
        entries.forEach(entry => {
            if (entry.key && entry.key.length > 0) {
                entry.key.forEach(keyword => characters.add(keyword));
            }
        });
        
        // 更新封面显示
        $('#diary-book-total-count').text(totalDiaries);
        $('#diary-book-character-count').text(characters.size);
        
        console.log(`📊 日记本统计: ${totalDiaries}篇日记, ${characters.size}个角色`);
        
    } catch (error) {
        console.error('❌ 更新日记本封面信息失败:', error);
        $('#diary-book-total-count').text('?');
        $('#diary-book-character-count').text('?');
    }
}

// 初始化预设列表弹窗（将HTML移动到body）
function createPresetDialog() {
    console.log('⚙️ 初始化预设列表弹窗...');
    
    // 将弹窗从设置面板移动到body
    $('#diary-preset-dialog').appendTo('body');
    
    console.log('✅ 预设列表弹窗已初始化');
    
    // 绑定事件
    bindPresetDialogEvents();
}

// 绑定预设弹窗事件
function bindPresetDialogEvents() {
    console.log('🔗 绑定预设弹窗事件...');
    
    // 关闭按钮
    $(document).on('click', '#diary-preset-close-btn', function() {
        console.log('❌ 点击关闭按钮');
        hidePresetDialog();
    });
    
    // 点击弹窗外部区域关闭
    $(document).on('click', '#diary-preset-dialog', function(e) {
        if (e.target === this) {
            console.log('❌ 点击外部区域，关闭预设列表');
            hidePresetDialog();
        }
    });
    
    // ESC键关闭
    $(document).on('keydown', function(e) {
        if (e.keyCode === 27 && $('#diary-preset-dialog').is(':visible')) { // ESC键
            console.log('⌨️ 按下ESC键，关闭预设列表');
            hidePresetDialog();
        }
    });
    
    // 预设卡片点击事件
    $(document).on('click', '.diary-preset-item', function() {
        const presetName = $(this).data('preset-name');
        const isCurrentlySelected = presetName === presetListState.selectedPreset;
        
        console.log(`👆 点击预设卡片: ${presetName}, 当前选中: ${isCurrentlySelected}`);
        
        // 如果点击的是已选中的预设，则取消选择
        if (isCurrentlySelected) {
            unselectPresetForDiary();
        } else {
            // 否则选择该预设
            selectPresetForDiary(presetName);
        }
    });
    
    // 分页按钮
    $(document).on('click', '#diary-preset-prev-page', function() {
        if (presetListState.currentPage > 1) {
            presetListState.currentPage--;
            renderPresetList();
        }
    });
    
    $(document).on('click', '#diary-preset-next-page', function() {
        if (presetListState.currentPage < presetListState.totalPages) {
            presetListState.currentPage++;
            renderPresetList();
        }
    });
    
    console.log('✅ 预设弹窗事件绑定完成');
}

// 初始化日记本弹窗（将HTML移动到body）
function createDiaryBookDialog() {
    console.log('📖 初始化日记本弹窗...');
    
    // 将弹窗从设置面板移动到body
    $('#diary-book-dialog').appendTo('body');
    
    console.log('✅ 日记本弹窗已初始化');
}

// 绑定日记本弹窗事件
function bindDiaryBookDialogEvents() {
    console.log('📖 绑定日记本弹窗事件...');
    
    // 关闭按钮点击事件
    $(document).on('click', '#diary-book-close-btn', function(e) {
        e.preventDefault();
        console.log('❌ 点击关闭按钮，关闭日记本');
        hideDiaryBookDialog();
    });
    
    // 点击弹窗外部区域关闭
    $(document).on('click', '#diary-book-dialog', function(e) {
        if (e.target === this) {
            console.log('❌ 点击外部区域，关闭日记本');
            hideDiaryBookDialog();
        }
    });
    
    // ESC键关闭
    $(document).on('keydown', function(e) {
        if (e.keyCode === 27 && $('#diary-book-dialog').is(':visible')) { // ESC键
            console.log('⌨️ 按下ESC键，关闭日记本');
            hideDiaryBookDialog();
        }
    });
    
    // 进入日记本按钮点击事件
    $(document).on('click', '#diary-book-enter-btn', function(e) {
        e.preventDefault();
        console.log('📖 点击进入日记本按钮');
        
        // 显示角色列表视图
        showDiaryBookCharacterList();
    });
    
    // 返回封面按钮点击事件
    $(document).on('click', '#diary-book-back-to-cover', function(e) {
        e.preventDefault();
        console.log('🔙 返回日记本封面');
        
        // 显示封面视图
        showDiaryBookCover();
    });
    
    // 分页按钮事件
    $(document).on('click', '#diary-book-prev-page', function(e) {
        e.preventDefault();
        console.log('⬅️ 点击上一页');
        goToPreviousCharacterPage();
    });
    
    $(document).on('click', '#diary-book-next-page', function(e) {
        e.preventDefault();
        console.log('➡️ 点击下一页');
        goToNextCharacterPage();
    });
    
    // 角色卡片点击事件
    $(document).on('click', '.diary-book-character-card', function(e) {
        e.preventDefault();
        const characterName = $(this).data('character');
        console.log(`👤 点击角色卡片: ${characterName}`);
        
        // 显示该角色的日记列表
        showDiaryBookDiaryList(characterName);
    });
    
    // 返回角色列表按钮点击事件
    $(document).on('click', '#diary-book-back-to-character-list', function(e) {
        e.preventDefault();
        console.log('🔙 返回角色列表');
        
        // 显示角色列表视图
        showDiaryBookCharacterList();
    });
    
    // 日记分页按钮事件
    $(document).on('click', '#diary-book-diary-prev-page', function(e) {
        e.preventDefault();
        console.log('⬅️ 日记列表：点击上一页');
        goToPreviousDiaryPage();
    });
    
    $(document).on('click', '#diary-book-diary-next-page', function(e) {
        e.preventDefault();
        console.log('➡️ 日记列表：点击下一页');
        goToNextDiaryPage();
    });
    
    // 日记卡片点击事件
    $(document).on('click', '.diary-book-diary-card', function(e) {
        e.preventDefault();
        const entryId = $(this).data('entry-id');
        const diaryTitle = $(this).data('diary-title');
        console.log(`📖 点击日记卡片: ${diaryTitle} (ID: ${entryId})`);
        
        // 显示日记详情
        showDiaryBookDetail(entryId);
    });
    
    // 返回日记列表按钮点击事件
    $(document).on('click', '#diary-book-back-to-diary-list', function(e) {
        e.preventDefault();
        console.log('🔙 从日记详情返回日记列表');
        
        // 返回到当前角色的日记列表
        if (diaryListState.currentCharacter) {
            showDiaryBookDiaryList(diaryListState.currentCharacter);
        }
    });
    
    // 删除日记按钮点击事件
    $(document).on('click', '#diary-book-delete-btn', async function(e) {
        e.preventDefault();
        console.log('🗑️ 点击删除日记按钮');
        
        // 确认删除
        const confirmDelete = confirm('确定要删除这篇日记吗？此操作无法撤销。');
        if (!confirmDelete) {
            console.log('❌ 用户取消删除');
            return;
        }
        
        // 执行删除
        await deleteDiary();
    });
    
    console.log('✅ 日记本弹窗事件绑定完成');
}

// ===== 角色列表功能 =====

// 角色列表状态
const characterListState = {
    characters: [], // 所有角色数据
    currentPage: 1, // 当前页码
    pageSize: 8,    // 每页显示角色数
    totalPages: 1   // 总页数
};

// 显示角色列表视图
async function showDiaryBookCharacterList() {
    console.log('👥 显示角色列表视图...');
    
    // 使用通用视图切换
    switchDiaryBookView('#diary-book-character-list-view');
    
    // 加载角色数据
    await loadCharacterData();
    
    // 渲染角色列表
    renderCharacterList();
}

// 从世界书加载角色数据
async function loadCharacterData() {
    try {
        console.log('📚 从世界书加载角色数据...');
        
        characterListState.characters = [];
        
        // 检查世界书是否存在
        const worldbookName = DIARY_WORLDBOOK_NAME;
        if (!world_names.includes(worldbookName)) {
            console.log('❌ 世界书不存在，无角色数据');
            return;
        }
        
        // 加载世界书数据
        const worldData = await loadWorldInfo(worldbookName);
        if (!worldData || !worldData.entries) {
            console.log('❌ 世界书数据为空');
            return;
        }
        
        // 统计每个角色的日记数量
        const characterStats = new Map();
        const entries = Object.values(worldData.entries);
        
        entries.forEach(entry => {
            if (entry.key && entry.key.length > 0) {
                entry.key.forEach(keyword => {
                    if (!characterStats.has(keyword)) {
                        characterStats.set(keyword, {
                            name: keyword,
                            count: 0
                        });
                    }
                    
                    const charData = characterStats.get(keyword);
                    charData.count++;
                });
            }
        });
        
        // 转换为数组并按日记数量排序
        characterListState.characters = Array.from(characterStats.values())
            .sort((a, b) => b.count - a.count);
        
        // 计算总页数
        characterListState.totalPages = Math.max(1, Math.ceil(characterListState.characters.length / characterListState.pageSize));
        characterListState.currentPage = 1;
        
        console.log(`📊 加载完成: ${characterListState.characters.length}个角色, ${characterListState.totalPages}页`);
        
    } catch (error) {
        console.error('❌ 加载角色数据失败:', error);
        characterListState.characters = [];
        characterListState.totalPages = 1;
        characterListState.currentPage = 1;
    }
}

// 渲染角色列表
function renderCharacterList() {
    console.log(`🎨 渲染角色列表 (第${characterListState.currentPage}页/${characterListState.totalPages}页)...`);
    
    const $grid = $('#diary-book-character-grid');
    const $empty = $('#diary-book-character-empty');
    
    // 清空网格
    $grid.empty();
    
    // 检查是否有角色数据
    if (characterListState.characters.length === 0) {
        $grid.hide();
        $empty.show();
        updateCharacterPagination();
        return;
    }
    
    $empty.hide();
    $grid.show();
    
    // 计算当前页显示的角色范围
    const startIndex = (characterListState.currentPage - 1) * characterListState.pageSize;
    const endIndex = Math.min(startIndex + characterListState.pageSize, characterListState.characters.length);
    const currentPageCharacters = characterListState.characters.slice(startIndex, endIndex);
    
    // 渲染角色卡片
    currentPageCharacters.forEach((character, index) => {
        const characterCard = createCharacterCard(character);
        $grid.append(characterCard);
        console.log(`🎭 添加角色卡片 ${index + 1}: ${character.name} (${character.count}篇日记)`);
    });
    
    // 更新分页信息
    updateCharacterPagination();
    
    // 调试：检查渲染结果
    console.log(`🎨 网格元素数量: ${$grid.children().length}`);
    console.log(`🎨 网格可见状态: ${$grid.is(':visible')}`);
    console.log(`🎨 网格HTML长度: ${$grid.html().length}`);
    
    console.log(`✅ 渲染完成: 显示${currentPageCharacters.length}个角色`);
}

// 创建角色卡片HTML
function createCharacterCard(character) {
    const avatar = character.name.charAt(0).toUpperCase();
    
    return `
        <div class="diary-book-character-card" data-character="${character.name}">
            <div class="diary-book-character-avatar">${avatar}</div>
            <div class="diary-book-character-info">
                <div class="diary-book-character-name">${character.name}</div>
                <div class="diary-book-character-stats">
                    <span class="diary-book-character-count">${character.count}</span>
                    <span class="diary-book-character-count-label">篇日记</span>
                </div>
            </div>
            <div class="diary-book-character-arrow">›</div>
        </div>
    `;
}

// 更新分页信息
function updateCharacterPagination() {
    console.log('📄 更新分页信息...');
    
    const $prevBtn = $('#diary-book-prev-page');
    const $nextBtn = $('#diary-book-next-page');
    const $pageInfo = $('#diary-book-page-info');
    
    // 更新页码信息
    $pageInfo.text(`第 ${characterListState.currentPage} 页，共 ${characterListState.totalPages} 页`);
    
    // 更新按钮状态
    $prevBtn.prop('disabled', characterListState.currentPage <= 1);
    $nextBtn.prop('disabled', characterListState.currentPage >= characterListState.totalPages);
    
    console.log(`📄 分页更新: ${characterListState.currentPage}/${characterListState.totalPages}`);
}

// 上一页
function goToPreviousCharacterPage() {
    if (characterListState.currentPage > 1) {
        characterListState.currentPage--;
        console.log(`⬅️ 切换到第${characterListState.currentPage}页`);
        renderCharacterList();
    }
}

// 下一页
function goToNextCharacterPage() {
    if (characterListState.currentPage < characterListState.totalPages) {
        characterListState.currentPage++;
        console.log(`➡️ 切换到第${characterListState.currentPage}页`);
        renderCharacterList();
    }
}

// ===== 日记列表功能 =====

// 日记列表状态
const diaryListState = {
    currentCharacter: '',  // 当前角色名
    diaries: [],          // 当前角色的所有日记
    currentPage: 1,       // 当前页码
    pageSize: 8,          // 每页显示日记数
    totalPages: 1         // 总页数
};

// 显示日记列表视图
async function showDiaryBookDiaryList(characterName) {
    console.log(`📚 显示${characterName}的日记列表...`);
    
    // 设置当前角色
    diaryListState.currentCharacter = characterName;
    
    // 使用通用视图切换
    switchDiaryBookView('#diary-book-diary-list-view');
    
    // 更新标题
    $('#diary-book-character-name').text(`${characterName}的日记`);
    
    // 加载该角色的日记数据
    await loadDiaryData(characterName);
    
    // 渲染日记列表
    renderDiaryList();
}

// 从世界书加载指定角色的日记数据
async function loadDiaryData(characterName) {
    try {
        console.log(`📚 从世界书加载${characterName}的日记数据...`);
        
        diaryListState.diaries = [];
        
        // 检查世界书是否存在
        const worldbookName = DIARY_WORLDBOOK_NAME;
        if (!world_names.includes(worldbookName)) {
            console.log('❌ 世界书不存在，无日记数据');
            return;
        }
        
        // 加载世界书数据
        const worldData = await loadWorldInfo(worldbookName);
        if (!worldData || !worldData.entries) {
            console.log('❌ 世界书数据为空');
            return;
        }
        
        // 筛选该角色的日记条目
        const entries = Object.values(worldData.entries);
        entries.forEach(entry => {
            if (entry.key && entry.key.includes(characterName)) {
                // 解析日记标题和时间 (格式: "标题-时间")
                let title = '无标题';
                let time = '未知时间';
                
                if (entry.comment && entry.comment.includes('-')) {
                    const parts = entry.comment.split('-');
                    title = parts[0].trim();
                    time = parts[1].trim();
                }
                
                // 添加到日记列表
                diaryListState.diaries.push({
                    id: entry.uid,
                    title: title,
                    time: time,
                    content: entry.content || '',
                    originalTitle: entry.comment || title
                });
            }
        });
        
        // 按时间排序（最新的在前面）
        diaryListState.diaries.sort((a, b) => {
            // 简单的时间比较，实际可能需要更复杂的解析
            return b.time.localeCompare(a.time);
        });
        
        // 计算总页数
        diaryListState.totalPages = Math.max(1, Math.ceil(diaryListState.diaries.length / diaryListState.pageSize));
        diaryListState.currentPage = 1;
        
        console.log(`📊 加载完成: ${characterName}共有${diaryListState.diaries.length}篇日记, ${diaryListState.totalPages}页`);
        
    } catch (error) {
        console.error(`❌ 加载${characterName}的日记数据失败:`, error);
        diaryListState.diaries = [];
        diaryListState.totalPages = 1;
        diaryListState.currentPage = 1;
    }
}

// 渲染日记列表
function renderDiaryList() {
    console.log(`🎨 渲染日记列表 (第${diaryListState.currentPage}页/${diaryListState.totalPages}页)...`);
    
    const $grid = $('#diary-book-diary-grid');
    const $empty = $('#diary-book-diary-empty');
    
    // 清空网格
    $grid.empty();
    
    // 检查是否有日记数据
    if (diaryListState.diaries.length === 0) {
        $grid.hide();
        $empty.show();
        updateDiaryPagination();
        return;
    }
    
    $empty.hide();
    $grid.show();
    
    // 计算当前页显示的日记范围
    const startIndex = (diaryListState.currentPage - 1) * diaryListState.pageSize;
    const endIndex = Math.min(startIndex + diaryListState.pageSize, diaryListState.diaries.length);
    const currentPageDiaries = diaryListState.diaries.slice(startIndex, endIndex);
    
    // 渲染日记卡片
    currentPageDiaries.forEach((diary, index) => {
        const diaryCard = createDiaryCard(diary);
        $grid.append(diaryCard);
        console.log(`📝 添加日记卡片 ${index + 1}: ${diary.title} (${diary.time})`);
    });
    
    // 更新分页信息
    updateDiaryPagination();
    
    // 调试：检查渲染结果
    console.log(`🎨 日记网格元素数量: ${$grid.children().length}`);
    console.log(`🎨 日记网格可见状态: ${$grid.is(':visible')}`);
    
    console.log(`✅ 渲染完成: 显示${currentPageDiaries.length}篇日记`);
}

// 创建日记卡片HTML
function createDiaryCard(diary) {
    // 截断标题（超过7个字用省略号替代）
    const truncatedTitle = truncateTitle(diary.title, 7);
    
    return `
        <div class="diary-book-diary-card" data-entry-id="${diary.id}" data-diary-title="${diary.title}">
            <div class="diary-book-diary-header">
                <div class="diary-book-diary-icon">📖</div>
                <div class="diary-book-diary-meta">
                    <div class="diary-book-diary-title" title="${diary.title}">${truncatedTitle}</div>
                    <div class="diary-book-diary-time">${diary.time}</div>
                </div>
            </div>
            <div class="diary-book-diary-arrow">›</div>
        </div>
    `;
}

// 截断标题函数
function truncateTitle(title, maxLength) {
    if (title.length <= maxLength) {
        return title;
    }
    return title.substring(0, maxLength) + '…';
}


// 更新日记分页信息
function updateDiaryPagination() {
    console.log('📄 更新日记分页信息...');
    
    const $prevBtn = $('#diary-book-diary-prev-page');
    const $nextBtn = $('#diary-book-diary-next-page');
    const $pageInfo = $('#diary-book-diary-page-info');
    
    // 更新页码信息
    $pageInfo.text(`第 ${diaryListState.currentPage} 页，共 ${diaryListState.totalPages} 页`);
    
    // 更新按钮状态
    $prevBtn.prop('disabled', diaryListState.currentPage <= 1);
    $nextBtn.prop('disabled', diaryListState.currentPage >= diaryListState.totalPages);
    
    console.log(`📄 日记分页更新: ${diaryListState.currentPage}/${diaryListState.totalPages}`);
}

// 上一页
function goToPreviousDiaryPage() {
    if (diaryListState.currentPage > 1) {
        diaryListState.currentPage--;
        console.log(`⬅️ 日记列表切换到第${diaryListState.currentPage}页`);
        renderDiaryList();
    }
}

// 下一页
function goToNextDiaryPage() {
    if (diaryListState.currentPage < diaryListState.totalPages) {
        diaryListState.currentPage++;
        console.log(`➡️ 日记列表切换到第${diaryListState.currentPage}页`);
        renderDiaryList();
    }
}

// ===== 日记详情功能 =====

// 日记详情状态
const diaryDetailState = {
    currentEntry: null  // 当前日记条目数据
};

// 显示日记详情视图
async function showDiaryBookDetail(entryId) {
    console.log(`📖 显示日记详情: ${entryId}...`);
    
    try {
        // 加载日记详情数据
        const diaryData = await loadDiaryDetailData(entryId);
        
        if (!diaryData) {
            toastr.error('无法加载日记详情', '日记本');
            return;
        }
        
        // 保存当前日记数据
        diaryDetailState.currentEntry = diaryData;
        
        // 使用通用视图切换
        switchDiaryBookView('#diary-book-detail-view');
        
        // 渲染日记详情
        renderDiaryDetail(diaryData);
        
    } catch (error) {
        console.error('❌ 显示日记详情失败:', error);
        toastr.error('显示日记详情失败', '日记本');
    }
}

// 从世界书加载日记详情数据
async function loadDiaryDetailData(entryId) {
    try {
        console.log(`📚 从世界书加载日记详情: ${entryId}...`);
        
        // 检查世界书是否存在
        const worldbookName = DIARY_WORLDBOOK_NAME;
        if (!world_names.includes(worldbookName)) {
            console.log('❌ 世界书不存在');
            return null;
        }
        
        // 加载世界书数据
        const worldData = await loadWorldInfo(worldbookName);
        if (!worldData || !worldData.entries) {
            console.log('❌ 世界书数据为空');
            return null;
        }
        
        // 查找指定的日记条目
        const entry = worldData.entries[entryId];
        if (!entry) {
            console.log(`❌ 找不到日记条目: ${entryId}`);
            return null;
        }
        
        // 解析日记标题和时间
        let title = '无标题';
        let time = '未知时间';
        
        if (entry.comment && entry.comment.includes('-')) {
            const parts = entry.comment.split('-');
            title = parts[0].trim();
            time = parts[1].trim();
        }
        
        // 获取角色名（从关键词中）
        let characterName = '未知角色';
        if (entry.key && entry.key.length > 0) {
            characterName = entry.key[0];
        }
        
        const diaryData = {
            id: entry.uid,
            title: title,
            time: time,
            content: entry.content || '暂无内容',
            character: characterName,
            originalTitle: entry.comment || title
        };
        
        console.log(`✅ 加载完成: 日记《${diaryData.title}》`);
        return diaryData;
        
    } catch (error) {
        console.error(`❌ 加载日记详情失败:`, error);
        return null;
    }
}

// 渲染日记详情
function renderDiaryDetail(diaryData) {
    console.log(`🎨 渲染日记详情: ${diaryData.title}...`);
    
    try {
        // 更新日记标题
        $('#diary-book-detail-title').text(diaryData.title);
        
        // 更新日记时间
        $('#diary-book-detail-time').text(diaryData.time);
        
        // 更新日记内容
        const formattedContent = formatDiaryContent(diaryData.content);
        $('#diary-book-detail-text').html(formattedContent);
        
        console.log(`✅ 渲染完成: 日记《${diaryData.title}》`);
        
    } catch (error) {
        console.error('❌ 渲染日记详情失败:', error);
        
        // 设置错误状态
        $('#diary-book-detail-title').text('加载失败');
        $('#diary-book-detail-time').text('');
        $('#diary-book-detail-text').text('无法显示日记内容');
    }
}

// 删除日记
async function deleteDiary() {
    try {
        if (!diaryDetailState.currentEntry) {
            console.error('❌ 没有当前日记数据');
            toastr.error('没有当前日记数据', '删除日记');
            return;
        }
        
        const entryId = diaryDetailState.currentEntry.id;
        const characterName = diaryDetailState.currentEntry.characterName;
        console.log(`🗑️ 删除日记: ${entryId}...`);
        
        // 检查世界书是否存在
        const worldbookName = DIARY_WORLDBOOK_NAME;
        if (!world_names.includes(worldbookName)) {
            console.log('❌ 世界书不存在');
            toastr.error('世界书不存在', '删除日记');
            return;
        }
        
        // 加载世界书数据
        const worldData = await loadWorldInfo(worldbookName);
        if (!worldData || !worldData.entries) {
            console.log('❌ 世界书数据为空');
            toastr.error('世界书数据为空', '删除日记');
            return;
        }
        
        // 检查条目是否存在
        if (!worldData.entries[entryId]) {
            console.log('❌ 日记条目不存在');
            toastr.error('日记条目不存在', '删除日记');
            return;
        }
        
        // 删除条目
        delete worldData.entries[entryId];
        console.log(`✅ 已从世界书中删除条目: ${entryId}`);
        
        // 保存世界书
        await saveWorldInfo(worldbookName, worldData);
        console.log('💾 世界书已保存');
        
        toastr.success('日记已删除', '日记本');
        
        // 清空当前日记状态
        diaryDetailState.currentEntry = null;
        
        // 返回到日记列表
        if (characterName) {
            await showDiaryBookDiaryList(characterName);
        } else {
            // 如果没有角色名，返回角色列表
            await showDiaryBookCharacterList();
        }
        
    } catch (error) {
        console.error('❌ 删除日记失败:', error);
        toastr.error(`删除日记失败: ${error.message}`, '删除日记');
    }
}

// 格式化日记内容（处理换行等）
function formatDiaryContent(content) {
    if (!content || content.trim().length === 0) {
        return '<p class="diary-book-detail-empty">此日记暂无内容</p>';
    }
    
    // 将换行符转换为HTML换行
    let formattedContent = content
        .replace(/\n\n/g, '</p><p>')  // 双换行转为段落
        .replace(/\n/g, '<br>');      // 单换行转为<br>
    
    // 包装在段落中
    if (!formattedContent.startsWith('<p>')) {
        formattedContent = '<p>' + formattedContent;
    }
    if (!formattedContent.endsWith('</p>')) {
        formattedContent = formattedContent + '</p>';
    }
    
    return formattedContent;
}

// 插件初始化
jQuery(async () => {
    console.log('🚀 日记本插件开始初始化...');
    
    try {
        // 加载HTML界面
        const settingsHtml = await $.get(`${extensionFolderPath}/index.html`);
        
        // 将设置界面添加到扩展设置面板
        $("#extensions_settings2").append(settingsHtml);
        
        // 绑定事件处理器
        
        // 绑定悬浮窗控制按钮
        $("#diary_toggle_float_window").on("click", toggleFloatWindow);
        $("#diary_reset_float_position").on("click", resetFloatWindowPosition);
        $("#diary_configure_presets").on("click", configurePresets);
        $("#diary_show_status").on("click", showPluginStatus);
        
        // 加载设置
        await loadSettings();
        
        // 创建悬浮窗
        createFloatWindow();
        
        // 创建自定义角色选择弹窗
        createCustomCharacterDialog();
        
        // 创建预设列表弹窗
        createPresetDialog();
        
        // 创建日记本弹窗
        createDiaryBookDialog();
        
        // 加载预设数据并更新显示
        await loadPresetData();
        
        // 绑定弹窗事件
        bindCustomCharacterDialogEvents();
        
        // 绑定日记本弹窗事件
        bindDiaryBookDialogEvents();
        
        // 根据设置显示或隐藏悬浮窗
        const settings = getCurrentSettings();
        if (settings.floatWindowVisible) {
            $('#diary-float-window').show();
        } else {
            $('#diary-float-window').hide();
        }
        
        console.log('✅ 日记本插件初始化完成');
        
        // 显示初始化完成提示
        if (isMobileDevice()) {
            toastr.success('日记本插件已加载 (移动端模式)', '插件已就绪');
        } else {
            toastr.success('日记本插件已加载', '插件已就绪');
        }
        
        // 显示插件状态
        showPluginStatus();
        
    } catch (error) {
        console.error('❌ 日记本插件初始化失败:', error);
        toastr.error(`插件初始化失败: ${error.message}`, '日记本插件');
    }
});
