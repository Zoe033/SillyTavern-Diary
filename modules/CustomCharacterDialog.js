/**
 * 自定义角色选择弹窗模块
 * 提供美观的角色选择界面
 */

import { getCurrentCharacterName } from './utils.js';

export class CustomCharacterDialog {
  constructor() {
    this.overlay = null;
    this.resolve = null;
  }

  /**
   * 显示自定义角色选择对话框
   */
  async showDialog(currentCharName = '') {
    return new Promise((resolve) => {
      this.resolve = resolve;
      const charName = currentCharName || getCurrentCharacterName();
      this.createDialog(charName);
      this.showOverlay();
    });
  }

  /**
   * 创建对话框DOM结构
   */
  createDialog(currentCharName) {
    // 确保样式存在
    this.ensureDiaryStyles();
    
    // 创建覆盖层
    this.overlay = $(`
      <div class="diary-custom-char-overlay">
        <div class="diary-custom-char-dialog">
          <div class="diary-custom-char-header">
            <h3>选择日记角色</h3>
            <button class="diary-custom-char-close" type="button">×</button>
          </div>
          <div class="diary-custom-char-content">
            <p>请选择要为哪个角色写日记：</p>
            <div class="diary-custom-char-input-group">
              <input type="text" 
                     class="diary-custom-char-input" 
                     placeholder="${currentCharName}" 
                     maxlength="50" 
                     autocomplete="off">
              <div class="diary-custom-char-hint">
                留空使用当前角色"${currentCharName}"，或输入自定义角色名
              </div>
            </div>
          </div>
          <div class="diary-custom-char-buttons">
            <button class="diary-custom-char-cancel" type="button">取消</button>
            <button class="diary-custom-char-send" type="button">发送</button>
          </div>
        </div>
      </div>
    `);
    
    // 添加到页面
    $('body').append(this.overlay);
    this.bindEvents();
  }

  /**
   * 确保样式存在
   */
  ensureDiaryStyles() {
    if ($('#diary-custom-char-styles').length === 0) {
      const styles = `
        <style id="diary-custom-char-styles">
          .diary-custom-char-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            animation: diary-char-fadeIn 0.3s ease-out forwards;
          }

          @keyframes diary-char-fadeIn {
            to { opacity: 1; }
          }

          .diary-custom-char-dialog {
            background: linear-gradient(135deg, #f8f9ff 0%, #e8f0fe 100%);
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            max-width: 480px;
            width: 90%;
            max-height: 90vh;
            overflow: hidden;
            position: relative;
            border: 1px solid rgba(255, 255, 255, 0.3);
            transform: scale(0.9) translateY(20px);
            animation: diary-char-slideIn 0.3s ease-out 0.1s forwards;
          }

          @keyframes diary-char-slideIn {
            to {
              transform: scale(1) translateY(0);
            }
          }

          .diary-custom-char-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
            position: relative;
          }

          .diary-custom-char-header h3 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
          }

          .diary-custom-char-close {
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: white;
            font-size: 28px;
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            width: 35px;
            height: 35px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
          }

          .diary-custom-char-close:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-50%) rotate(90deg);
          }

          .diary-custom-char-content {
            padding: 24px;
          }

          .diary-custom-char-content p {
            margin: 0 0 20px 0;
            color: #4a5568;
            font-size: 16px;
            line-height: 1.5;
          }

          .diary-custom-char-input-group {
            position: relative;
          }

          .diary-custom-char-input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            font-size: 16px;
            background: white;
            transition: all 0.3s ease;
            box-sizing: border-box;
          }

          .diary-custom-char-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }

          .diary-custom-char-input::placeholder {
            color: #a0aec0;
            font-style: italic;
          }

          .diary-custom-char-hint {
            margin-top: 8px;
            font-size: 13px;
            color: #718096;
            line-height: 1.4;
          }

          .diary-custom-char-buttons {
            padding: 20px 24px;
            background: #f7fafc;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            border-top: 1px solid #e2e8f0;
          }

          .diary-custom-char-buttons button {
            padding: 10px 24px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            min-width: 80px;
          }

          .diary-custom-char-cancel {
            background: #e2e8f0;
            color: #4a5568;
          }

          .diary-custom-char-cancel:hover {
            background: #cbd5e0;
            transform: translateY(-1px);
          }

          .diary-custom-char-send {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          .diary-custom-char-send:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
          }

          .diary-custom-char-send:active {
            transform: translateY(0);
          }

          /* 移动端适配 */
          @media (max-width: 600px) {
            .diary-custom-char-dialog {
              width: 95%;
              max-width: none;
              margin: 10px;
            }

            .diary-custom-char-header {
              padding: 16px;
            }

            .diary-custom-char-header h3 {
              font-size: 18px;
            }

            .diary-custom-char-content {
              padding: 20px;
            }

            .diary-custom-char-buttons {
              padding: 16px 20px;
              flex-direction: column-reverse;
            }

            .diary-custom-char-buttons button {
              width: 100%;
              padding: 12px;
            }
          }
        </style>
      `;
      $('head').append(styles);
    }
  }

  /**
   * 显示覆盖层
   */
  showOverlay() {
    if (this.overlay) {
      // 自动聚焦输入框
      setTimeout(() => {
        this.overlay.find('.diary-custom-char-input').focus();
      }, 400);
    }
  }

  /**
   * 绑定事件处理器
   */
  bindEvents() {
    if (!this.overlay) return;
    
    const self = this;
    
    // 关闭按钮
    this.overlay.find('.diary-custom-char-close').on('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      self.handleResult(null);
    });
    
    // 取消按钮
    this.overlay.find('.diary-custom-char-cancel').on('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      self.handleResult(null);
    });
    
    // 发送按钮
    this.overlay.find('.diary-custom-char-send').on('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const inputValue = self.overlay.find('.diary-custom-char-input').val();
      self.handleResult(inputValue || '');
    });
    
    // 输入框回车键
    this.overlay.find('.diary-custom-char-input').on('keydown', function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        const inputValue = $(this).val();
        self.handleResult(inputValue || '');
      } else if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        self.handleResult(null);
      }
    });
    
    // 点击覆盖层背景关闭
    this.overlay.on('click', function(e) {
      if (e.target === this) {
        self.handleResult(null);
      }
    });
    
    // 阻止对话框内部点击传播
    this.overlay.find('.diary-custom-char-dialog').on('click', function(e) {
      e.stopPropagation();
    });

    // 防止页面滚动
    $('body').css('overflow', 'hidden');
  }

  /**
   * 处理结果
   */
  handleResult(result) {
    if (this.resolve) {
      this.resolve(result);
      this.resolve = null;
    }
    this.hide();
  }

  /**
   * 隐藏对话框
   */
  hide() {
    if (this.overlay) {
      this.overlay.css('animation', 'diary-char-fadeOut 0.3s ease-out forwards');
      
      // 添加淡出动画
      const fadeOutStyle = `
        @keyframes diary-char-fadeOut {
          to { opacity: 0; transform: scale(0.95); }
        }
      `;
      
      if ($('#diary-char-fadeout').length === 0) {
        $('head').append(`<style id="diary-char-fadeout">${fadeOutStyle}</style>`);
      }
      
      setTimeout(() => {
        this.cleanup();
      }, 300);
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    // 恢复页面滚动
    $('body').css('overflow', '');
    
    this.resolve = null;
  }
}

/**
 * 显示自定义角色选择对话框的便捷函数
 */
export async function showCustomCharacterDialog(currentCharName = '') {
  const dialog = new CustomCharacterDialog();
  return await dialog.showDialog(currentCharName);
}
