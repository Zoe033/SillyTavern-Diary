/**
 * 日记UI界面管理模块
 * 负责精美的日记本界面显示和交互
 */

import { isMobileDevice, showConfirmDialog, formatTimestamp } from './utils.js';

export class DiaryUI {
  constructor(diaryStorage, presetManager) {
    this.diaryStorage = diaryStorage;
    this.presetManager = presetManager;
    
    // 界面状态
    this.currentCharacter = null;
    this.currentEntries = [];
    this.currentPage = 0;
    this.diariesData = {};
    this.currentViewingEntry = null;
    
    // 分页设置
    this.entriesPerPage = 8;
  }

  /**
   * 显示日记界面
   */
  showDiaryInterface(diariesData) {
    this.diariesData = diariesData;
    this.currentCharacter = null;
    this.currentViewingEntry = null;
    this.currentPage = 0;

    this.injectStyles();
    this.createPopupStructure();
    this.bindEvents();
    this.showCover();
  }

  /**
   * 清理资源
   */
  cleanup() {
    $('.diary-popup-overlay').remove();
    $('body').removeClass('diary-popup-active');
    
    // 恢复页面滚动
    $('body').css('overflow', '');
    
    // 清理状态
    this.currentCharacter = null;
    this.currentEntries = [];
    this.currentPage = 0;
    this.diariesData = {};
    this.currentViewingEntry = null;
  }

  /**
   * 注入样式
   */
  injectStyles() {
    if ($('#diary-ui-styles').length > 0) {
      return;
    }

    const styles = `
      <style id="diary-ui-styles">
        .diary-popup-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(25, 25, 35, 0.95) 0%, rgba(15, 15, 25, 0.98) 100%);
          backdrop-filter: blur(10px);
          z-index: 10000;
          opacity: 0;
          animation: diary-ui-fadeIn 0.5s ease-out forwards;
          overflow: hidden;
        }

        @keyframes diary-ui-fadeIn {
          to { opacity: 1; }
        }

        .diary-popup-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
        }

        .diary-book {
          width: 900px;
          max-width: 95vw;
          height: 600px;
          max-height: 85vh;
          background: linear-gradient(145deg, #f8f6f0 0%, #f0ede4 50%, #e8e3d8 100%);
          border-radius: 16px;
          box-shadow: 
            0 25px 50px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset,
            0 -4px 8px rgba(0, 0, 0, 0.1) inset;
          position: relative;
          overflow: hidden;
          transform: scale(0.9) rotateY(-5deg);
          animation: diary-ui-bookOpen 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s forwards;
          perspective: 1000px;
        }

        @keyframes diary-ui-bookOpen {
          to {
            transform: scale(1) rotateY(0deg);
          }
        }

        /* 书籍装饰效果 */
        .diary-book::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          width: 4px;
          height: 100%;
          background: linear-gradient(to bottom, 
            rgba(160, 140, 120, 0.3) 0%,
            rgba(160, 140, 120, 0.6) 50%,
            rgba(160, 140, 120, 0.3) 100%);
          transform: translateX(-50%);
          z-index: 1;
        }

        .diary-book::after {
          content: '';
          position: absolute;
          top: 10px;
          left: 10px;
          right: 10px;
          bottom: 10px;
          border: 1px solid rgba(160, 140, 120, 0.2);
          border-radius: 12px;
          pointer-events: none;
        }

        /* 关闭按钮 */
        .diary-close {
          position: absolute;
          top: 15px;
          right: 15px;
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #c9a96e 0%, #b8935a 100%);
          border: none;
          border-radius: 50%;
          color: white;
          font-size: 20px;
          cursor: pointer;
          z-index: 10;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .diary-close:hover {
          background: linear-gradient(135deg, #d4b074 0%, #c39960 100%);
          transform: rotate(90deg) scale(1.1);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        /* 页面内容区域 */
        .diary-content {
          position: relative;
          width: 100%;
          height: 100%;
          padding: 60px 40px 40px 40px;
          box-sizing: border-box;
          overflow: hidden;
        }

        /* 封面页面 */
        .diary-page-cover {
          display: none;
          text-align: center;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
        }

        .diary-cover-title {
          font-size: 36px;
          font-weight: 700;
          color: #8b4513;
          margin-bottom: 20px;
          text-shadow: 2px 2px 4px rgba(139, 69, 19, 0.3);
          letter-spacing: 2px;
        }

        .diary-cover-subtitle {
          font-size: 18px;
          color: #a0522d;
          margin-bottom: 40px;
          font-style: italic;
        }

        .diary-cover-stats {
          background: rgba(255, 255, 255, 0.3);
          padding: 20px 30px;
          border-radius: 12px;
          border: 1px solid rgba(160, 140, 120, 0.3);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .diary-stat-item {
          margin: 8px 0;
          font-size: 16px;
          color: #654321;
        }

        .diary-stat-value {
          font-weight: 600;
          color: #8b4513;
        }

        /* 角色列表页面 */
        .diary-page-characters {
          display: none;
        }

        .diary-characters-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .diary-characters-title {
          font-size: 28px;
          color: #8b4513;
          margin-bottom: 10px;
          font-weight: 600;
        }

        .diary-characters-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          max-height: 400px;
          overflow-y: auto;
          padding: 10px;
        }

        .diary-character-item {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(240, 235, 220, 0.6) 100%);
          padding: 20px;
          border-radius: 12px;
          border: 1px solid rgba(160, 140, 120, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .diary-character-item::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .diary-character-item:hover::before {
          opacity: 1;
        }

        .diary-character-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
          border-color: rgba(160, 140, 120, 0.5);
        }

        .diary-character-name {
          font-size: 18px;
          font-weight: 600;
          color: #8b4513;
          margin-bottom: 8px;
        }

        .diary-character-count {
          font-size: 14px;
          color: #a0522d;
        }

        /* 日记列表页面 */
        .diary-page-entries {
          display: none;
        }

        .diary-entries-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 2px solid rgba(160, 140, 120, 0.2);
        }

        .diary-back-btn {
          background: linear-gradient(135deg, #c9a96e 0%, #b8935a 100%);
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .diary-back-btn:hover {
          background: linear-gradient(135deg, #d4b074 0%, #c39960 100%);
          transform: translateY(-1px);
        }

        .diary-entries-character {
          font-size: 24px;
          color: #8b4513;
          font-weight: 600;
          flex-grow: 1;
          text-align: center;
        }

        .diary-entries-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
          max-height: 420px;
          overflow-y: auto;
          padding: 5px;
        }

        .diary-entry-item {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(250, 245, 235, 0.7) 100%);
          padding: 18px;
          border-radius: 10px;
          border: 1px solid rgba(160, 140, 120, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .diary-entry-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          border-color: rgba(160, 140, 120, 0.5);
        }

        .diary-entry-title {
          font-size: 16px;
          font-weight: 600;
          color: #8b4513;
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .diary-entry-time {
          font-size: 13px;
          color: #a0522d;
          margin-bottom: 10px;
        }

        .diary-entry-preview {
          font-size: 14px;
          color: #654321;
          line-height: 1.4;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }

        /* 分页 */
        .diary-pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 20px;
          gap: 10px;
        }

        .diary-page-btn {
          background: linear-gradient(135deg, #c9a96e 0%, #b8935a 100%);
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .diary-page-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #d4b074 0%, #c39960 100%);
          transform: translateY(-1px);
        }

        .diary-page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .diary-page-info {
          font-size: 14px;
          color: #8b4513;
          margin: 0 10px;
        }

        /* 日记详情页面 */
        .diary-page-detail {
          display: none;
        }

        .diary-detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid rgba(160, 140, 120, 0.2);
        }

        .diary-detail-title {
          font-size: 24px;
          color: #8b4513;
          font-weight: 600;
          flex-grow: 1;
          text-align: center;
        }

        .diary-detail-actions {
          display: flex;
          gap: 10px;
        }

        .diary-delete-btn {
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .diary-delete-btn:hover {
          background: linear-gradient(135deg, #e04555 0%, #d02441 100%);
          transform: translateY(-1px);
        }

        .diary-detail-content {
          max-height: 440px;
          overflow-y: auto;
          padding: 20px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 10px;
          border: 1px solid rgba(160, 140, 120, 0.3);
        }

        .diary-detail-meta {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(160, 140, 120, 0.2);
        }

        .diary-detail-time {
          font-size: 16px;
          color: #a0522d;
          font-style: italic;
        }

        .diary-detail-char {
          font-size: 14px;
          color: #8b7355;
          margin-top: 5px;
        }

        .diary-detail-text {
          font-size: 16px;
          line-height: 1.6;
          color: #2d1810;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        /* 空数据提示 */
        .diary-empty-message {
          text-align: center;
          color: #a0522d;
          font-size: 18px;
          margin-top: 100px;
          font-style: italic;
        }

        /* 移动端适配 */
        @media (max-width: 768px) {
          .diary-book {
            width: 100%;
            height: 100%;
            border-radius: 0;
            max-width: none;
            max-height: none;
          }

          .diary-content {
            padding: 40px 20px 20px 20px;
          }

          .diary-cover-title {
            font-size: 28px;
          }

          .diary-characters-list {
            grid-template-columns: 1fr;
            gap: 15px;
          }

          .diary-entries-list {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .diary-entries-header {
            flex-direction: column;
            gap: 10px;
            text-align: center;
          }

          .diary-detail-header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
          }

          .diary-detail-title {
            font-size: 20px;
          }
        }

        /* 滚动条样式 */
        .diary-characters-list::-webkit-scrollbar,
        .diary-entries-list::-webkit-scrollbar,
        .diary-detail-content::-webkit-scrollbar {
          width: 8px;
        }

        .diary-characters-list::-webkit-scrollbar-track,
        .diary-entries-list::-webkit-scrollbar-track,
        .diary-detail-content::-webkit-scrollbar-track {
          background: rgba(160, 140, 120, 0.1);
          border-radius: 4px;
        }

        .diary-characters-list::-webkit-scrollbar-thumb,
        .diary-entries-list::-webkit-scrollbar-thumb,
        .diary-detail-content::-webkit-scrollbar-thumb {
          background: rgba(160, 140, 120, 0.4);
          border-radius: 4px;
        }

        .diary-characters-list::-webkit-scrollbar-thumb:hover,
        .diary-entries-list::-webkit-scrollbar-thumb:hover,
        .diary-detail-content::-webkit-scrollbar-thumb:hover {
          background: rgba(160, 140, 120, 0.6);
        }

        body.diary-popup-active {
          overflow: hidden;
        }
      </style>
    `;

    $('head').append(styles);
  }

  /**
   * 创建弹窗结构
   */
  createPopupStructure() {
    const structure = `
      <div class="diary-popup-overlay">
        <div class="diary-popup-container">
          <div class="diary-book">
            <button class="diary-close" title="关闭">×</button>
            
            <div class="diary-content">
              <!-- 封面页 -->
              <div class="diary-page diary-page-cover">
                <div class="diary-cover-title">📖 我的日记本</div>
                <div class="diary-cover-subtitle">记录每一个美好的时光</div>
                <div class="diary-cover-stats">
                  <div class="diary-stat-item">
                    总计日记: <span class="diary-stat-value" id="diary-total-count">0</span> 篇
                  </div>
                  <div class="diary-stat-item">
                    角色数量: <span class="diary-stat-value" id="diary-char-count">0</span> 个
                  </div>
                </div>
              </div>

              <!-- 角色列表页 -->
              <div class="diary-page diary-page-characters">
                <div class="diary-characters-header">
                  <div class="diary-characters-title">选择角色</div>
                  <button class="diary-back-btn">← 返回封面</button>
                </div>
                <div class="diary-characters-list" id="diary-characters-container">
                  <!-- 动态生成角色列表 -->
                </div>
              </div>

              <!-- 日记列表页 -->
              <div class="diary-page diary-page-entries">
                <div class="diary-entries-header">
                  <button class="diary-back-btn">← 返回角色</button>
                  <div class="diary-entries-character" id="diary-current-character"></div>
                  <div></div>
                </div>
                <div class="diary-entries-list" id="diary-entries-container">
                  <!-- 动态生成日记列表 -->
                </div>
                <div class="diary-pagination">
                  <button class="diary-page-btn" id="diary-prev-page" disabled>上一页</button>
                  <div class="diary-page-info" id="diary-page-info">1 / 1</div>
                  <button class="diary-page-btn" id="diary-next-page" disabled>下一页</button>
                </div>
              </div>

              <!-- 日记详情页 -->
              <div class="diary-page diary-page-detail">
                <div class="diary-detail-header">
                  <button class="diary-back-btn">← 返回列表</button>
                  <div class="diary-detail-title" id="diary-detail-title"></div>
                  <div class="diary-detail-actions">
                    <button class="diary-delete-btn" id="diary-detail-delete">删除</button>
                  </div>
                </div>
                <div class="diary-detail-content">
                  <div class="diary-detail-meta">
                    <div class="diary-detail-time" id="diary-detail-time"></div>
                    <div class="diary-detail-char" id="diary-detail-char"></div>
                  </div>
                  <div class="diary-detail-text" id="diary-detail-text"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    $('body').append(structure).addClass('diary-popup-active');
  }

  /**
   * 绑定事件处理器
   */
  bindEvents() {
    const self = this;

    // 关闭按钮
    $('.diary-close').on('click', () => {
      self.cleanup();
    });

    // ESC键关闭
    $(document).on('keydown.diary-ui', (e) => {
      if (e.key === 'Escape') {
        self.cleanup();
      }
    });

    // 点击背景关闭
    $('.diary-popup-overlay').on('click', (e) => {
      if (e.target === e.currentTarget) {
        self.cleanup();
      }
    });

    // 返回按钮
    $('.diary-back-btn').on('click', function() {
      const currentPage = $(this).closest('.diary-page');
      
      if (currentPage.hasClass('diary-page-characters')) {
        self.showCover();
      } else if (currentPage.hasClass('diary-page-entries')) {
        self.showCharacterList();
      } else if (currentPage.hasClass('diary-page-detail')) {
        self.showCharacterDiaries(self.currentCharacter, self.currentPage);
      }
    });

    // 分页按钮
    $('#diary-prev-page').on('click', () => {
      if (self.currentPage > 0) {
        self.currentPage--;
        self.renderEntries(self.currentPage);
        self.renderPagination();
      }
    });

    $('#diary-next-page').on('click', () => {
      const totalPages = Math.ceil(self.currentEntries.length / self.entriesPerPage);
      if (self.currentPage < totalPages - 1) {
        self.currentPage++;
        self.renderEntries(self.currentPage);
        self.renderPagination();
      }
    });

    // 删除按钮
    $('#diary-detail-delete').on('click', async () => {
      if (self.currentViewingEntry) {
        await self.handleDeleteClick(self.currentViewingEntry);
      }
    });

    // 阻止内容区点击传播
    $('.diary-book').on('click', (e) => {
      e.stopPropagation();
    });

    // 卸载时清理
    $(window).on('beforeunload.diary-ui', () => {
      $(document).off('.diary-ui');
      $(window).off('.diary-ui');
    });
  }

  /**
   * 显示封面
   */
  showCover() {
    this.hideAllPages();
    $('.diary-page-cover').show();

    // 更新统计信息
    const characters = Object.keys(this.diariesData);
    const totalDiaries = characters.reduce((sum, char) => sum + this.diariesData[char].length, 0);

    $('#diary-total-count').text(totalDiaries);
    $('#diary-char-count').text(characters.length);

    // 点击封面进入角色列表
    $('.diary-page-cover').off('click').on('click', () => {
      if (characters.length === 0) {
        this.showEmptyDataMessage();
      } else {
        this.showCharacterList();
      }
    });
  }

  /**
   * 显示角色列表
   */
  showCharacterList() {
    this.hideAllPages();
    $('.diary-page-characters').show();
    this.renderCharacters();
  }

  /**
   * 显示空数据提示
   */
  showEmptyDataMessage() {
    this.hideAllPages();
    
    // 创建空数据提示
    const emptyMessage = `
      <div class="diary-page diary-page-empty" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;">
        <div class="diary-empty-message">
          <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
          <div style="font-size: 24px; margin-bottom: 15px; color: #8b4513;">还没有日记</div>
          <div style="font-size: 16px; color: #a0522d; margin-bottom: 30px;">开始写下你的第一篇日记吧！</div>
          <button class="diary-back-btn" style="font-size: 16px; padding: 12px 24px;">← 返回封面</button>
        </div>
      </div>
    `;
    
    // 如果已存在空页面，先移除
    $('.diary-page-empty').remove();
    
    // 添加空页面
    $('.diary-content').append(emptyMessage);
    $('.diary-page-empty').show();
    
    // 绑定返回按钮
    $('.diary-page-empty .diary-back-btn').on('click', () => {
      this.showCover();
    });
  }

  /**
   * 显示角色的日记列表
   */
  showCharacterDiaries(characterName, page = 0) {
    if (!characterName || !this.diariesData[characterName]) {
      console.warn('[日记UI] 角色不存在:', characterName);
      return;
    }

    this.currentCharacter = characterName;
    this.currentEntries = this.diariesData[characterName];
    this.currentPage = page;

    this.hideAllPages();
    $('.diary-page-entries').show();
    
    $('#diary-current-character').text(characterName);
    this.renderEntries(page);
    this.renderPagination();
  }

  /**
   * 显示日记详情
   */
  showDetail(entry) {
    this.currentViewingEntry = entry;
    
    this.hideAllPages();
    $('.diary-page-detail').show();
    
    $('#diary-detail-title').text(entry.title);
    $('#diary-detail-time').text(`写于 ${entry.time}`);
    $('#diary-detail-char').text(`角色: ${entry.charName}`);
    $('#diary-detail-text').text(entry.content);
  }

  /**
   * 隐藏所有页面
   */
  hideAllPages() {
    $('.diary-page').hide();
    $('.diary-page-empty').remove();
  }

  /**
   * 渲染角色列表
   */
  renderCharacters() {
    const container = $('#diary-characters-container');
    container.empty();

    const characters = Object.keys(this.diariesData);
    if (characters.length === 0) {
      container.html('<div class="diary-empty-message">没有找到任何日记</div>');
      return;
    }

    characters.forEach(characterName => {
      const diaryCount = this.diariesData[characterName].length;
      const characterItem = $(`
        <div class="diary-character-item" data-character="${characterName}">
          <div class="diary-character-name">${characterName}</div>
          <div class="diary-character-count">${diaryCount} 篇日记</div>
        </div>
      `);

      characterItem.on('click', () => {
        this.showCharacterDiaries(characterName, 0);
      });

      container.append(characterItem);
    });
  }

  /**
   * 渲染日记条目
   */
  renderEntries(page) {
    const container = $('#diary-entries-container');
    container.empty();

    if (!this.currentEntries || this.currentEntries.length === 0) {
      container.html('<div class="diary-empty-message">这个角色还没有日记</div>');
      return;
    }

    const startIndex = page * this.entriesPerPage;
    const endIndex = Math.min(startIndex + this.entriesPerPage, this.currentEntries.length);
    const pageEntries = this.currentEntries.slice(startIndex, endIndex);

    pageEntries.forEach(entry => {
      const preview = entry.content.length > 100 
        ? entry.content.substring(0, 100) + '...' 
        : entry.content;

      const entryItem = $(`
        <div class="diary-entry-item" data-uid="${entry.uid}">
          <div class="diary-entry-title">${entry.title}</div>
          <div class="diary-entry-time">${entry.time}</div>
          <div class="diary-entry-preview">${preview}</div>
        </div>
      `);

      entryItem.on('click', () => {
        this.showDetail(entry);
      });

      container.append(entryItem);
    });
  }

  /**
   * 渲染分页控件
   */
  renderPagination() {
    const totalPages = Math.ceil(this.currentEntries.length / this.entriesPerPage);
    const currentPage = this.currentPage + 1;

    $('#diary-page-info').text(`${currentPage} / ${totalPages}`);
    
    $('#diary-prev-page').prop('disabled', this.currentPage <= 0);
    $('#diary-next-page').prop('disabled', this.currentPage >= totalPages - 1);
  }

  /**
   * 处理删除点击
   */
  async handleDeleteClick(entry) {
    try {
      const confirmed = await showConfirmDialog(
        `确定要删除日记"${entry.title}"吗？\n\n删除后将无法恢复。`,
        '确认删除'
      );

      if (!confirmed) {
        return;
      }

      console.log(`[日记UI] 准备删除日记: ${entry.title} (UID: ${entry.uid})`);
      
      const success = await this.diaryStorage.deleteDiaryEntry(entry.uid);
      if (!success) {
        throw new Error('删除操作失败');
      }

      toastr.success(`日记"${entry.title}"已删除`, '删除成功');
      
      // 重新加载数据并刷新界面
      await this.refreshAfterDelete(entry);
      
    } catch (error) {
      console.error('[日记UI] 删除日记失败:', error);
      toastr.error(`删除失败: ${error.message}`, '错误');
    }
  }

  /**
   * 删除后刷新界面
   */
  async refreshAfterDelete(deletedEntry) {
    try {
      // 重新获取数据
      this.diariesData = await this.diaryStorage.getAllDiaries();
      
      // 更新当前角色的条目列表
      if (this.currentCharacter) {
        this.currentEntries = this.diariesData[this.currentCharacter] || [];
        
        // 如果当前角色没有日记了，返回角色列表
        if (this.currentEntries.length === 0) {
          this.showCharacterList();
          return;
        }
        
        // 调整当前页码（如果当前页没有条目了）
        const totalPages = Math.ceil(this.currentEntries.length / this.entriesPerPage);
        if (this.currentPage >= totalPages && totalPages > 0) {
          this.currentPage = totalPages - 1;
        }
        
        // 返回日记列表页面
        this.showCharacterDiaries(this.currentCharacter, this.currentPage);
      } else {
        // 如果在详情页删除，返回封面
        this.showCover();
      }
      
    } catch (error) {
      console.error('[日记UI] 刷新界面失败:', error);
      // 如果刷新失败，至少返回封面
      this.showCover();
    }
  }

  /**
   * 显示删除确认对话框
   */
  async showDeleteConfirmation(entry) {
    return new Promise((resolve) => {
      const confirmDialog = $(`
        <div class="diary-confirm-overlay" style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 11000;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div class="diary-confirm-dialog" style="
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          ">
            <h3 style="margin: 0 0 15px 0; color: #8b4513;">确认删除</h3>
            <p style="margin: 0 0 25px 0; color: #666; line-height: 1.5;">
              确定要删除日记"${entry.title}"吗？<br>
              <small style="color: #999;">删除后将无法恢复</small>
            </p>
            <div style="display: flex; gap: 15px; justify-content: center;">
              <button class="diary-confirm-cancel" style="
                background: #e2e8f0;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                color: #4a5568;
              ">取消</button>
              <button class="diary-confirm-ok" style="
                background: #dc3545;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                color: white;
              ">删除</button>
            </div>
          </div>
        </div>
      `);

      $('body').append(confirmDialog);

      confirmDialog.find('.diary-confirm-cancel').on('click', () => {
        confirmDialog.remove();
        resolve(false);
      });

      confirmDialog.find('.diary-confirm-ok').on('click', () => {
        confirmDialog.remove();
        resolve(true);
      });

      // 点击背景取消
      confirmDialog.on('click', (e) => {
        if (e.target === confirmDialog[0]) {
          confirmDialog.remove();
          resolve(false);
        }
      });
    });
  }
}
