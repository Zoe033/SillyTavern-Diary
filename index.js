/**
 * SillyTavern 日记本插件
 * 版本: 2.3.0
 * 
 * 功能特性:
 * - 自动监听和记录日记
 * - 精美的日记界面
 * - 智能预设切换
 * - 自定义角色支持
 * - 移动端优化
 * - 自动删除聊天记录
 */

// SillyTavern 插件 API 导入
// 注意：这些变量由 SillyTavern 全局提供，无需导入
// const extension_settings = window.SillyTavern.extensionSettings;
// const saveSettingsDebounced = window.SillyTavern.saveSettingsDebounced;

// 导入模块
import { DiaryStorage } from "./modules/DiaryStorage.js";
import { PresetManager } from "./modules/PresetManager.js";
import { DiaryParser } from "./modules/DiaryParser.js";
import { DiaryUI } from "./modules/DiaryUI.js";
import { showCustomCharacterDialog } from "./modules/CustomCharacterDialog.js";
import { getCurrentCharacterName, isMobileDevice } from "./modules/utils.js";

// 插件常量
const extensionName = "diary";
const extensionFolderPath = "./scripts/extensions/third-party/SillyTavern-Diary";

// 核心模块实例
let diaryStorage = null;
let presetManager = null;
let diaryParser = null;
let diaryUI = null;

// 插件状态
let isInitialized = false;
let currentListeningState = 'stopped'; // 'stopped', 'listening', 'processing'

/**
 * 获取插件设置
 */
function getExtensionSettings() {
    if (typeof extension_settings === 'undefined') {
        return window.SillyTavern?.extensionSettings?.[extensionName] || {};
    }
    return extension_settings[extensionName] || {};
}

/**
 * 保存插件设置
 */
async function saveExtensionSettings(newSettings) {
    try {
        // 使用全局 extension_settings 或 SillyTavern API
        const settingsObject = typeof extension_settings !== 'undefined' 
            ? extension_settings 
            : window.SillyTavern?.extensionSettings || {};
            
        settingsObject[extensionName] = {
            ...getExtensionSettings(),
            ...newSettings
        };
        
        // 使用全局保存函数或 SillyTavern API
        if (typeof saveSettingsDebounced !== 'undefined') {
            await saveSettingsDebounced();
        } else if (window.SillyTavern?.saveSettingsDebounced) {
            await window.SillyTavern.saveSettingsDebounced();
        } else {
            // 备用保存方式
            localStorage.setItem('SillyTavern_extensionSettings', JSON.stringify(settingsObject));
        }
        
        console.log('[日记本] 设置已保存:', settingsObject[extensionName]);
    } catch (error) {
        console.error('[日记本] 保存设置失败:', error);
        toastr.error('保存设置失败', '错误');
    }
}

/**
 * 初始化插件设置
 */
async function loadSettings() {
    try {
        // 初始化默认设置
        const defaultSettings = {
            selectedPreset: '',
            autoDelete: true,
            mobileOptimized: isMobileDevice(),
            worldbookName: '日记本',
            discoveredPresets: [],
            lastPresetRefresh: 0
        };

        // 获取设置对象
        const settingsObject = typeof extension_settings !== 'undefined' 
            ? extension_settings 
            : window.SillyTavern?.extensionSettings || {};

        // 合并设置
        settingsObject[extensionName] = {
            ...defaultSettings,
            ...getExtensionSettings()
        };

        // 更新UI
        updateSettingsUI();
        
        console.log('[日记本] 设置已加载:', settingsObject[extensionName]);
    } catch (error) {
        console.error('[日记本] 加载设置失败:', error);
    }
}

/**
 * 更新设置界面
 */
function updateSettingsUI() {
    const settings = getExtensionSettings();
    
    // 更新复选框
    $("#diary_auto_delete").prop("checked", settings.autoDelete !== false);
    $("#diary_mobile_optimized").prop("checked", settings.mobileOptimized === true);
    
    // 更新世界书名称
    $("#diary_worldbook_name").val(settings.worldbookName || '日记本');
    
    // 更新预设选择
    updatePresetSelect(settings.selectedPreset);
    
    // 更新状态显示
    updateStatusDisplay();
}

/**
 * 更新预设选择下拉框
 */
async function updatePresetSelect(selectedPreset = '') {
    try {
        const select = $("#diary_preset_select");
        const statusSpan = $("#diary_preset_status");
        
        // 显示加载状态
        statusSpan.text('正在加载预设列表...');
        
        if (!presetManager) {
            statusSpan.text('预设管理器未初始化');
            return;
        }
        
        const presets = await presetManager.getAvailablePresets();
        
        // 清空并重新填充选项
        select.empty().append('<option value="">请选择预设...</option>');
        
        presets.forEach(preset => {
            const option = $('<option>').val(preset).text(preset);
            if (preset === selectedPreset) {
                option.prop('selected', true);
            }
            select.append(option);
        });
        
        // 更新状态
        if (presets.length > 0) {
            statusSpan.text(`发现 ${presets.length} 个预设`);
        } else {
            statusSpan.text('未发现任何预设');
        }
        
        console.log(`[日记本] 预设列表已更新: ${presets.length} 个预设`);
    } catch (error) {
        console.error('[日记本] 更新预设列表失败:', error);
        $("#diary_preset_status").text('预设加载失败');
    }
}

/**
 * 更新状态显示
 */
function updateStatusDisplay() {
    try {
        // 更新监听状态
        const statusElement = $("#diary_listening_status");
        let statusText = '未启动';
        let statusClass = '';
        
        switch (currentListeningState) {
            case 'listening':
                statusText = '监听中';
                statusClass = 'text-success';
                break;
            case 'processing':
                statusText = '处理中';
                statusClass = 'text-warning';
                break;
            case 'stopped':
            default:
                statusText = '未启动';
                statusClass = 'text-muted';
                break;
        }
        
        statusElement.text(statusText).attr('class', `diary-status-badge ${statusClass}`);
        
        // 更新日记总数
        updateDiaryCount();
        
    } catch (error) {
        console.warn('[日记本] 更新状态显示失败:', error);
    }
}

/**
 * 更新日记总数显示
 */
async function updateDiaryCount() {
    try {
        if (!diaryStorage) {
            $("#diary_total_count").text('0');
            return;
        }
        
        const stats = await diaryStorage.getDiaryStats();
        $("#diary_total_count").text(stats.totalDiaries || 0);
    } catch (error) {
        console.warn('[日记本] 获取日记统计失败:', error);
        $("#diary_total_count").text('?');
    }
}

/**
 * 初始化核心模块
 */
async function initializeModules() {
    try {
        const settings = getExtensionSettings();
        const worldbookName = settings.worldbookName || '日记本';
        
        // 初始化存储模块
        diaryStorage = new DiaryStorage(worldbookName);
        console.log('[日记本] 存储模块已初始化');
        
        // 初始化预设管理器
        presetManager = new PresetManager(extensionName);
        console.log('[日记本] 预设管理器已初始化');
        
        // 初始化解析器
        diaryParser = new DiaryParser(diaryStorage, presetManager);
        console.log('[日记本] 消息解析器已初始化');
        
        // 初始化UI管理器
        diaryUI = new DiaryUI(diaryStorage, presetManager);
        console.log('[日记本] UI管理器已初始化');
        
        // 确保世界书存在
        await diaryStorage.ensureWorldbook();
        
        isInitialized = true;
        console.log('[日记本] 所有模块初始化完成');
        
        // 更新界面
        updateStatusDisplay();
        
    } catch (error) {
        console.error('[日记本] 模块初始化失败:', error);
        toastr.error(`模块初始化失败: ${error.message}`, '初始化错误');
        isInitialized = false;
    }
}

/**
 * 检查模块是否已初始化
 */
function checkInitialization() {
    if (!isInitialized) {
        toastr.warning('插件尚未初始化完成，请稍后再试', '请稍候');
        return false;
    }
    return true;
}

/**
 * 设置监听状态
 */
function setListeningState(state) {
    currentListeningState = state;
    updateStatusDisplay();
}

/**
 * 打开日记本
 */
async function handleDiaryBookClick() {
    try {
        if (!checkInitialization()) return;
        
        console.log('[日记本] 打开日记界面...');
        toastr.info('正在加载日记数据...', '请稍候');
        
        // 获取所有日记数据
        const diariesData = await diaryStorage.getAllDiaries();
        console.log('[日记本] 日记数据已加载:', diariesData);
        
        // 显示日记界面
        diaryUI.showDiaryInterface(diariesData);
        
        toastr.success('日记本已打开', '成功');
        
    } catch (error) {
        console.error('[日记本] 打开日记本失败:', error);
        toastr.error(`打开日记本失败: ${error.message}`, '错误');
    }
}

/**
 * 写日记功能
 */
async function handleWriteDiaryClick() {
    try {
        if (!checkInitialization()) return;
        
        console.log('[日记本] 开始写日记流程...');
        
        // 获取当前角色名
        const currentCharName = getCurrentCharacterName();
        console.log(`[日记本] 当前角色: ${currentCharName}`);
        
        // 显示自定义角色选择对话框
        const customCharacterName = await showCustomCharacterDialog(currentCharName);
        
        if (customCharacterName === null) {
            console.log('[日记本] 用户取消了写日记操作');
            toastr.info('已取消写日记', '取消');
            return;
        }
        
        // 处理角色名称
        const finalCharacterName = customCharacterName.trim() || currentCharName;
        console.log(`[日记本] 使用角色名: ${finalCharacterName}`);
        
        // 设置监听状态
        setListeningState('listening');
        
        // 开始监听（根据是否有自定义角色名选择不同的启动方式）
        if (customCharacterName.trim()) {
            await diaryParser.startListeningWithCustomCharacter(finalCharacterName);
        } else {
            await diaryParser.startListening();
        }
        
        console.log('[日记本] 日记监听已启动');
        
        // 发送日记提示（使用STscript）
        const diaryPrompt = `请为角色"${finalCharacterName}"写一篇日记，格式如下：
［日记标题：写一个简短的标题］
［日记时间：${new Date().toLocaleString('zh-CN')}］
［日记内容：详细记录今天的经历、感受和想法］`;
        
        // 使用SillyTavern的消息发送功能
        await window.SillyTavern.executeSlashCommandsWithOptions(`/send ${diaryPrompt}`, {
            abortController: new AbortController()
        });
        
        // 移动端给出额外提示
        if (isMobileDevice()) {
            toastr.info('移动端环境，请耐心等待AI回复完成', '写日记已启动');
        } else {
            toastr.success('已发送日记提示，等待AI回复后自动保存', '写日记已启动');
        }
        
    } catch (error) {
        console.error('[日记本] 写日记失败:', error);
        setListeningState('stopped');
        
        // 停止监听
        if (diaryParser) {
            await diaryParser.stopListening();
        }
        
        toastr.error(`写日记失败: ${error.message}`, '错误');
    }
}

/**
 * 记录功能（手动处理最新消息）
 */
async function handleRecordClick() {
    try {
        if (!checkInitialization()) return;
        
        console.log('[日记本] 开始手动记录...');
        setListeningState('processing');
        
        toastr.info('正在处理最新消息...', '记录中');
        
        // 处理最新消息
        const success = await diaryParser.processLatestMessage();
        
        if (success) {
            toastr.success('日记记录成功', '记录完成');
            updateDiaryCount(); // 更新日记计数
        } else {
            toastr.warning('未找到有效的日记格式', '记录失败');
        }
        
    } catch (error) {
        console.error('[日记本] 手动记录失败:', error);
        toastr.error(`记录失败: ${error.message}`, '错误');
    } finally {
        setListeningState('stopped');
    }
}

/**
 * 导出日记
 */
async function handleExportClick() {
    try {
        if (!checkInitialization()) return;
        
        console.log('[日记本] 开始导出日记...');
        toastr.info('正在导出日记数据...', '导出中');
        
        const exportData = await diaryStorage.exportAllDiaries();
        
        // 创建下载链接
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diary_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toastr.success('日记数据已导出', '导出完成');
        
    } catch (error) {
        console.error('[日记本] 导出失败:', error);
        toastr.error(`导出失败: ${error.message}`, '错误');
    }
}

/**
 * 清空数据
 */
async function handleClearClick() {
    try {
        if (!checkInitialization()) return;
        
        // 确认对话框
        const confirmed = await window.SillyTavern.callGenericPopup(
            '确定要清空所有日记数据吗？\n\n这个操作无法撤销！',
            window.SillyTavern.POPUP_TYPE.CONFIRM,
            '',
            { okButton: '确定清空', cancelButton: '取消' }
        );
        
        if (confirmed !== window.SillyTavern.POPUP_RESULT.AFFIRMATIVE) {
            return;
        }
        
        console.log('[日记本] 开始清空数据...');
        toastr.info('正在清空日记数据...', '清空中');
        
        const deletedCount = await diaryStorage.clearAllDiaries();
        
        toastr.success(`已清空 ${deletedCount} 条日记`, '清空完成');
        updateDiaryCount(); // 更新日记计数
        
    } catch (error) {
        console.error('[日记本] 清空数据失败:', error);
        toastr.error(`清空失败: ${error.message}`, '错误');
    }
}

/**
 * 刷新预设列表
 */
async function handleRefreshPresets() {
    try {
        if (!checkInitialization()) return;
        
        console.log('[日记本] 刷新预设列表...');
        $("#diary_preset_status").text('正在刷新预设列表...');
        
        const presets = await presetManager.refreshPresetList();
        await updatePresetSelect(getExtensionSettings().selectedPreset);
        
        toastr.success(`发现 ${presets.length} 个预设`, '刷新完成');
        
    } catch (error) {
        console.error('[日记本] 刷新预设失败:', error);
        $("#diary_preset_status").text('刷新失败');
        toastr.error(`刷新预设失败: ${error.message}`, '错误');
    }
}

/**
 * 绑定事件处理器
 */
function bindEventHandlers() {
    // 主要功能按钮
    $("#diary_book_btn").on("click", handleDiaryBookClick);
    $("#diary_write_btn").on("click", handleWriteDiaryClick);
    $("#diary_record_btn").on("click", handleRecordClick);
    
    // 工具按钮
    $("#diary_export_btn").on("click", handleExportClick);
    $("#diary_clear_btn").on("click", handleClearClick);
    $("#diary_refresh_presets").on("click", handleRefreshPresets);
    
    // 设置变更监听
    $("#diary_preset_select").on("change", async function() {
        const selectedPreset = $(this).val();
        await saveExtensionSettings({ selectedPreset });
        
        if (presetManager) {
            await presetManager.setDiaryPreset(selectedPreset);
        }
        
        console.log(`[日记本] 日记预设已设置为: ${selectedPreset || '(未设置)'}`);
        toastr.success('预设设置已保存', '设置成功');
    });
    
    $("#diary_auto_delete").on("change", async function() {
        const autoDelete = $(this).prop("checked");
        await saveExtensionSettings({ autoDelete });
        console.log(`[日记本] 自动删除设置: ${autoDelete}`);
    });
    
    $("#diary_mobile_optimized").on("change", async function() {
        const mobileOptimized = $(this).prop("checked");
        await saveExtensionSettings({ mobileOptimized });
        console.log(`[日记本] 移动端优化: ${mobileOptimized}`);
    });
    
    $("#diary_worldbook_name").on("change", async function() {
        const worldbookName = $(this).val().trim() || '日记本';
        await saveExtensionSettings({ worldbookName });
        
        // 重新初始化存储模块
        if (diaryStorage) {
            diaryStorage = new DiaryStorage(worldbookName);
            await diaryStorage.ensureWorldbook();
        }
        
        console.log(`[日记本] 世界书名称已设置为: ${worldbookName}`);
        toastr.success('世界书设置已保存', '设置成功');
    });
    
    console.log('[日记本] 事件处理器已绑定');
}

/**
 * 插件主初始化函数
 */
jQuery(async () => {
    try {
        console.log('[日记本] 开始初始化插件...');
        
        // 尝试多种路径加载插件界面HTML
        let settingsHtml = '';
        const possiblePaths = [
            './index.html',
            `${extensionFolderPath}/index.html`,
            './scripts/extensions/third-party/SillyTavern-Diary/index.html'
        ];
        
        for (const path of possiblePaths) {
            try {
                settingsHtml = await $.get(path);
                console.log(`[日记本] 从路径加载界面成功: ${path}`);
                break;
            } catch (error) {
                console.warn(`[日记本] 路径加载失败: ${path}`, error.message);
            }
        }
        
        if (!settingsHtml) {
            // 如果无法加载 HTML 文件，使用内联 HTML 作为备用
            console.warn('[日记本] 无法加载外部 HTML 文件，使用内联 HTML');
            settingsHtml = `
                <!-- 日记本插件主界面 - 内联版本 -->
                <div class="diary-extension-settings">
                    <div class="inline-drawer">
                        <div class="inline-drawer-toggle inline-drawer-header">
                            <b>📖 日记本 Diary</b>
                            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                        </div>
                        <div class="inline-drawer-content">
                            <!-- 主要功能按钮区域 -->
                            <div class="diary-main-buttons flex-container">
                                <input id="diary_book_btn" class="menu_button diary-button" type="submit" value="📚 打开日记本" />
                                <input id="diary_write_btn" class="menu_button diary-button" type="submit" value="✏️ 写日记" />
                                <input id="diary_record_btn" class="menu_button diary-button" type="submit" value="📝 记录" />
                            </div>
                            <hr class="sysHR" />
                            <!-- 预设配置区域 -->
                            <div class="diary-preset-config">
                                <h4>预设配置</h4>
                                <div class="diary-preset-row flex-container">
                                    <label for="diary_preset_select" class="diary-label">日记预设:</label>
                                    <select id="diary_preset_select" class="text_pole">
                                        <option value="">请选择预设...</option>
                                    </select>
                                    <input id="diary_refresh_presets" class="menu_button small_button" type="submit" value="🔄 刷新" />
                                </div>
                                <div class="diary-preset-info">
                                    <small id="diary_preset_status" class="text-muted"></small>
                                </div>
                            </div>
                            <hr class="sysHR" />
                            <!-- 状态显示区域 -->
                            <div class="diary-status-section">
                                <h4>状态信息</h4>
                                <div class="diary-status-item flex-container">
                                    <label class="diary-label">监听状态:</label>
                                    <span id="diary_listening_status" class="diary-status-badge">未启动</span>
                                </div>
                                <div class="diary-status-item flex-container">
                                    <label class="diary-label">日记总数:</label>
                                    <span id="diary_total_count" class="diary-count-badge">0</span>
                                </div>
                            </div>
                            <hr class="sysHR" />
                            <!-- 高级设置区域 -->
                            <div class="diary-advanced-settings">
                                <h4>高级设置</h4>
                                <div class="diary-setting-row flex-container">
                                    <input id="diary_auto_delete" type="checkbox" />
                                    <label for="diary_auto_delete">保存成功后自动删除聊天记录</label>
                                </div>
                                <div class="diary-setting-row flex-container">
                                    <input id="diary_mobile_optimized" type="checkbox" />
                                    <label for="diary_mobile_optimized">移动端优化模式</label>
                                </div>
                                <div class="diary-setting-row flex-container">
                                    <label for="diary_worldbook_name" class="diary-label">世界书名称:</label>
                                    <input id="diary_worldbook_name" type="text" class="text_pole" value="日记本" placeholder="日记数据存储的世界书名称"/>
                                </div>
                            </div>
                            <hr class="sysHR" />
                            <!-- 操作按钮区域 -->
                            <div class="diary-action-buttons flex-container">
                                <input id="diary_export_btn" class="menu_button" type="submit" value="📤 导出日记" />
                                <input id="diary_clear_btn" class="menu_button warning-button" type="submit" value="🗑️ 清空数据" />
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        $("#extensions_settings").append(settingsHtml);
        console.log('[日记本] 界面已加载');
        
        // 加载设置
        await loadSettings();
        console.log('[日记本] 设置已加载');
        
        // 绑定事件处理器
        bindEventHandlers();
        
        // 延迟初始化核心模块（等待SillyTavern完全加载）
        setTimeout(async () => {
            try {
                await initializeModules();
                
                // 初始化完成后更新预设列表
                if (presetManager) {
                    await updatePresetSelect(getExtensionSettings().selectedPreset);
                }
                
                toastr.success('日记本插件初始化完成', '初始化成功');
            } catch (error) {
                console.error('[日记本] 延迟初始化失败:', error);
                toastr.error('插件初始化失败，部分功能可能无法正常使用', '初始化错误');
            }
        }, 2000); // 延迟2秒初始化
        
    } catch (error) {
        console.error('[日记本] 插件加载失败:', error);
        toastr.error(`插件加载失败: ${error.message}`, '加载错误');
    }
});

// 导出必要的函数供调试使用
window.diaryPlugin = {
    getStorage: () => diaryStorage,
    getPresetManager: () => presetManager,
    getParser: () => diaryParser,
    getUI: () => diaryUI,
    getSettings: getExtensionSettings,
    reinitialize: initializeModules
};
