/**
 * 角色选择弹窗模块
 * 负责显示自定义角色选择界面，允许用户选择写日记的角色名称
 */

export class CharacterDialog {
    constructor() {
        this.overlay = null;
        this.resolve = null;
        this.currentCharName = '';
        this.isMobile = this.detectMobile();
    }

    /**
     * 检测移动端设备
     * @returns {boolean} 是否为移动端
     */
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    /**
     * 显示自定义角色选择弹窗
     * @param {string} currentCharName 当前角色卡名称，用作placeholder
     * @returns {Promise<string|null>} 返回用户输入的角色名，null表示取消
     */
    async showDialog(currentCharName = '') {
        return new Promise((resolve) => {
            this.currentCharName = currentCharName;
            this.resolve = resolve;
            this.createDialog(currentCharName);
            this.bindEvents();
        });
    }

    /**
     * 创建弹窗DOM结构
     * @param {string} currentCharName 当前角色卡名称
     */
    createDialog(currentCharName) {
        // 移除可能存在的旧弹窗
        this.cleanup();
        
        // 确保样式已注入
        this.ensureStyles();
        
        // 创建弹窗HTML
        const dialogHtml = this.createDialogHTML(currentCharName);
        
        // 添加到页面
        this.overlay = $(dialogHtml);
        $('body').append(this.overlay);
        
        // 显示弹窗
        this.showOverlay();
    }

    /**
     * 创建弹窗HTML结构
     * @param {string} currentCharName 当前角色卡名称
     * @returns {string} HTML字符串
     */
    createDialogHTML(currentCharName) {
        const placeholderText = currentCharName || '请输入角色名称';
        
        return `
        <div class="diary-char-overlay" id="diary-char-popup">
          <div class="diary-popup-content diary-char-content">
            <div class="diary-header">
              <h3 class="diary-title">选择写日记角色</h3>
              <button class="diary-close-btn" id="diary-char-close">×</button>
            </div>
            <div class="diary-content diary-char-dialog-content">
              <div class="diary-char-hint">
                可以填写写日记角色的名字，不填写将使用角色卡名称
              </div>
              <div class="diary-char-input-section">
                <input 
                  type="text" 
                  class="diary-char-input" 
                  id="diary-custom-char-input"
                  placeholder="${placeholderText}"
                  maxlength="50"
                  autocomplete="off"
                />
              </div>
              <div class="diary-char-buttons">
                <button class="diary-char-btn diary-char-send" id="diary-char-send">
                  <i class="fa-solid fa-paper-plane"></i> 发送
                </button>
                <button class="diary-char-btn diary-char-cancel" id="diary-char-cancel">
                  <i class="fa-solid fa-times"></i> 取消
                </button>
              </div>
              ${this.isMobile ? '' : this.createShortcutHint()}
            </div>
          </div>
        </div>
        `;
    }

    /**
     * 创建快捷键提示
     * @returns {string} 快捷键提示HTML
     */
    createShortcutHint() {
        return `
        <div class="diary-char-shortcut-hint">
          按 <kbd>Enter</kbd> 发送，<kbd>Esc</kbd> 取消
        </div>
        `;
    }

    /**
     * 确保样式已注入
     */
    ensureStyles() {
        // 基础样式已通过CSS文件加载
        // 这里只需要确保特定的样式存在
        if ($('#diary-char-dialog-styles').length === 0) {
            console.log(`💄 [CharacterDialog] 基础样式已通过CSS文件加载`);
        }
    }

    /**
     * 显示弹窗
     */
    showOverlay() {
        if (this.overlay) {
            // 添加显示类
            this.overlay.addClass('show');
            
            // 延迟聚焦输入框，确保动画完成
            setTimeout(() => {
                this.focusInput();
            }, 100);
        }
    }

    /**
     * 聚焦输入框
     */
    focusInput() {
        const input = this.overlay?.find('#diary-custom-char-input');
        if (input && input.length > 0) {
            input.focus();
            
            // 移动端特殊处理：确保输入框可见
            if (this.isMobile) {
                setTimeout(() => {
                    input[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
        }
    }

    /**
     * 绑定事件处理器
     */
    bindEvents() {
        if (!this.overlay) return;
        
        const self = this;
        
        // 发送按钮
        this.overlay.find('#diary-char-send').on('click', () => {
            self.handleSend();
        });
        
        // 取消按钮
        this.overlay.find('#diary-char-cancel').on('click', () => {
            self.handleCancel();
        });
        
        // 关闭按钮
        this.overlay.find('#diary-char-close').on('click', () => {
            self.handleCancel();
        });
        
        // 输入框事件
        const input = this.overlay.find('#diary-custom-char-input');
        
        // 键盘事件
        input.on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                self.handleSend();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                self.handleCancel();
            }
        });
        
        // 输入验证
        input.on('input', (e) => {
            self.validateInput(e.target);
        });
        
        // 点击遮罩层关闭弹窗
        this.overlay.on('click', (e) => {
            if (e.target === this.overlay[0]) {
                self.handleCancel();
            }
        });
        
        // 阻止弹窗内容区域的点击事件冒泡
        this.overlay.find('.diary-popup-content').on('click', (e) => {
            e.stopPropagation();
        });
        
        // 全局键盘事件
        $(document).on('keydown.diary-char-dialog', (e) => {
            if (e.key === 'Escape') {
                self.handleCancel();
            }
        });
    }

    /**
     * 验证输入内容
     * @param {HTMLInputElement} inputElement 输入框元素
     */
    validateInput(inputElement) {
        const value = inputElement.value.trim();
        const $input = $(inputElement);
        
        // 移除之前的错误状态
        $input.removeClass('error success');
        
        // 验证字符长度
        if (value.length > 50) {
            $input.addClass('error');
            this.showInputError('角色名称不能超过50个字符');
            return false;
        }
        
        // 验证特殊字符（可选）
        const invalidChars = /[<>:"\/\\|?*\x00-\x1f]/;
        if (value && invalidChars.test(value)) {
            $input.addClass('error');
            this.showInputError('角色名称包含非法字符');
            return false;
        }
        
        // 验证通过
        if (value) {
            $input.addClass('success');
        }
        
        this.clearInputError();
        return true;
    }

    /**
     * 显示输入错误提示
     * @param {string} message 错误消息
     */
    showInputError(message) {
        // 移动端使用toast提示，桌面端可以使用其他方式
        if (this.isMobile) {
            toastr.error(message, '输入错误', { timeOut: 3000 });
        } else {
            // 可以在这里添加更精细的错误提示显示
            console.warn(`[CharacterDialog] 输入错误: ${message}`);
        }
    }

    /**
     * 清除输入错误提示
     */
    clearInputError() {
        // 清除错误状态相关的UI
        const sendButton = this.overlay?.find('#diary-char-send');
        if (sendButton) {
            sendButton.prop('disabled', false);
        }
    }

    /**
     * 处理发送操作
     */
    handleSend() {
        const input = this.overlay?.find('#diary-custom-char-input');
        if (!input) return;
        
        const value = input.val().trim();
        
        // 验证输入
        if (!this.validateInput(input[0])) {
            return;
        }
        
        // 显示加载状态
        this.setButtonLoading('#diary-char-send', true);
        
        // 延迟处理，给用户反馈时间
        setTimeout(() => {
            const finalValue = value || this.currentCharName || null;
            console.log(`✅ [CharacterDialog] 用户选择角色: ${finalValue || '(使用当前角色)'}`);
            this.handleResult(finalValue);
        }, 300);
    }

    /**
     * 处理取消操作
     */
    handleCancel() {
        console.log(`❌ [CharacterDialog] 用户取消选择`);
        this.handleResult(null);
    }

    /**
     * 设置按钮加载状态
     * @param {string} buttonSelector 按钮选择器
     * @param {boolean} loading 是否加载中
     */
    setButtonLoading(buttonSelector, loading) {
        const button = this.overlay?.find(buttonSelector);
        if (!button) return;
        
        if (loading) {
            button.addClass('loading').prop('disabled', true);
        } else {
            button.removeClass('loading').prop('disabled', false);
        }
    }

    /**
     * 处理结果并关闭弹窗
     * @param {string|null} result 结果值
     */
    handleResult(result) {
        if (this.resolve) {
            this.resolve(result);
            this.resolve = null;
        }
        this.hide();
    }

    /**
     * 隐藏弹窗
     */
    hide() {
        if (this.overlay) {
            this.overlay.removeClass('show');
            
            // 等待动画完成后清理
            setTimeout(() => {
                this.cleanup();
            }, 300);
        }
    }

    /**
     * 清理弹窗DOM和事件
     */
    cleanup() {
        // 移除全局键盘事件监听
        $(document).off('keydown.diary-char-dialog');
        
        // 移除弹窗DOM
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        
        // 重置状态
        this.resolve = null;
        this.currentCharName = '';
    }

    /**
     * 获取弹窗状态
     * @returns {Object} 状态信息
     */
    getStatus() {
        return {
            isVisible: this.overlay && this.overlay.hasClass('show'),
            currentCharName: this.currentCharName,
            isMobile: this.isMobile,
            hasOverlay: !!this.overlay
        };
    }

    /**
     * 强制关闭弹窗（用于清理）
     */
    forceClose() {
        if (this.resolve) {
            this.resolve(null);
        }
        this.cleanup();
    }

    /**
     * 设置移动端模式
     * @param {boolean} isMobile 是否为移动端
     */
    setMobileMode(isMobile) {
        this.isMobile = isMobile;
    }

    /**
     * 预加载弹窗（提前创建DOM但不显示）
     * @param {string} currentCharName 当前角色名
     */
    preload(currentCharName) {
        try {
            this.currentCharName = currentCharName;
            
            // 确保样式已注入
            this.ensureStyles();
            
            // 预创建DOM但不显示
            const dialogHtml = this.createDialogHTML(currentCharName);
            const tempOverlay = $(dialogHtml);
            
            // 添加到页面但不显示
            tempOverlay.css('display', 'none');
            $('body').append(tempOverlay);
            
            // 立即移除（只是为了确保CSS已加载）
            setTimeout(() => {
                tempOverlay.remove();
            }, 100);
            
            console.log(`⚡ [CharacterDialog] 预加载完成: ${currentCharName}`);
        } catch (error) {
            console.error(`❌ [CharacterDialog] 预加载失败:`, error);
        }
    }

    /**
     * 验证角色名称格式
     * @param {string} name 角色名称
     * @returns {Object} 验证结果 {valid: boolean, error?: string}
     */
    static validateCharacterName(name) {
        if (!name) {
            return { valid: true }; // 空值表示使用默认角色名，是有效的
        }
        
        if (typeof name !== 'string') {
            return { valid: false, error: '角色名称必须是字符串' };
        }
        
        const trimmedName = name.trim();
        
        if (trimmedName.length === 0) {
            return { valid: true }; // 空字符串也表示使用默认角色名
        }
        
        if (trimmedName.length > 50) {
            return { valid: false, error: '角色名称不能超过50个字符' };
        }
        
        // 检查非法字符
        const invalidChars = /[<>:"\/\\|?*\x00-\x1f]/;
        if (invalidChars.test(trimmedName)) {
            return { valid: false, error: '角色名称包含非法字符' };
        }
        
        return { valid: true };
    }

    /**
     * 创建简化版弹窗（用于快速输入）
     * @param {string} title 弹窗标题
     * @param {string} placeholder 输入框占位符
     * @returns {Promise<string|null>} 用户输入结果
     */
    static async showQuickInput(title, placeholder) {
        return new Promise((resolve) => {
            const quickHtml = `
            <div class="diary-char-overlay diary-quick-input" id="diary-quick-input">
              <div class="diary-char-content">
                <div class="diary-header">
                  <h3 class="diary-title">${title}</h3>
                </div>
                <div class="diary-char-dialog-content">
                  <div class="diary-char-input-section">
                    <input 
                      type="text" 
                      class="diary-char-input" 
                      id="quick-input"
                      placeholder="${placeholder}"
                      maxlength="50"
                      autocomplete="off"
                    />
                  </div>
                  <div class="diary-char-buttons">
                    <button class="diary-char-btn diary-char-send" id="quick-send">
                      <i class="fa-solid fa-check"></i> 确认
                    </button>
                    <button class="diary-char-btn diary-char-cancel" id="quick-cancel">
                      <i class="fa-solid fa-times"></i> 取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
            `;
            
            const $overlay = $(quickHtml);
            $('body').append($overlay);
            
            const cleanup = () => {
                $overlay.remove();
                $(document).off('keydown.quick-input');
            };
            
            // 事件绑定
            $overlay.find('#quick-send').on('click', () => {
                const value = $overlay.find('#quick-input').val().trim();
                cleanup();
                resolve(value || null);
            });
            
            $overlay.find('#quick-cancel').on('click', () => {
                cleanup();
                resolve(null);
            });
            
            $overlay.find('#quick-input').on('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    $overlay.find('#quick-send').click();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    $overlay.find('#quick-cancel').click();
                }
            });
            
            $(document).on('keydown.quick-input', (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            });
            
            // 显示弹窗
            setTimeout(() => {
                $overlay.addClass('show');
                $overlay.find('#quick-input').focus();
            }, 100);
        });
    }
}
