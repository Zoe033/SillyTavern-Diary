/**
 * 日记界面管理模块
 * 负责所有日记相关的用户界面交互和显示
 */

export class DiaryUI {
    constructor(diaryStorage, presetManager, settings) {
        this.diaryStorage = diaryStorage;
        this.presetManager = presetManager;
        this.settings = settings;
        
        // 界面状态管理
        this.currentCharacter = null;
        this.currentEntries = [];
        this.currentPage = 0;
        this.diariesData = {};
        this.currentViewingEntry = null;
        
        // 分页设置
        this.pageSize = 8;
        
        // 移动端检测
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
     * 显示日记主界面
     * @param {Object} diariesData 日记数据（按角色分组）
     */
    showDiaryInterface(diariesData) {
        try {
            console.log(`📖 [DiaryUI] 显示日记界面...`);
            
            // 保存数据
            this.diariesData = diariesData;
            
            // 清理旧的界面
            this.cleanup();
            
            console.log(`💄 [DiaryUI] 注入样式...`);
            this.injectStyles();
            
            console.log(`🏗️ [DiaryUI] 创建弹窗结构...`);
            this.createPopupStructure();
            
            console.log(`🔗 [DiaryUI] 绑定事件...`);
            this.bindEvents();
            
            console.log(`📊 [DiaryUI] 显示封面页...`);
            this.showCover();
            
            // 显示弹窗
            setTimeout(() => {
                $('#diary-popup').addClass('show');
            }, 100);
            
            console.log(`✅ [DiaryUI] 日记界面显示完成`);
        } catch (error) {
            console.error(`❌ [DiaryUI] 显示界面失败:`, error);
            toastr.error('打开日记界面失败，请稍后重试', '界面错误');
        }
    }

    /**
     * 清理界面资源
     */
    cleanup() {
        // 移除可能存在的旧弹窗
        $('#diary-popup').remove();
        
        // 重置状态
        this.currentCharacter = null;
        this.currentEntries = [];
        this.currentPage = 0;
        this.currentViewingEntry = null;
    }

    /**
     * 注入CSS样式
     */
    injectStyles() {
        // 样式已通过插件的CSS文件加载，这里只需要确保样式ID存在
        if ($('#diary-styles').length === 0) {
            console.log(`💄 [DiaryUI] 样式文件未找到，使用备用样式`);
            // 可以在这里添加备用样式或从CSS文件重新加载
        }
    }

    /**
     * 创建弹窗HTML结构
     */
    createPopupStructure() {
        console.log(`🏗️ [DiaryUI] 开始创建弹窗结构...`);
        
        const totalEntries = Object.values(this.diariesData).reduce((sum, entries) => sum + entries.length, 0);
        const totalCharacters = Object.keys(this.diariesData).length;
        
        console.log(`📊 [DiaryUI] 统计数据 - 总条目:`, totalEntries, '总角色:', totalCharacters);
        
        const popupHtml = `
        <div class="diary-popup-overlay" id="diary-popup">
          <div class="diary-popup-content">
            <div class="diary-header">
              <h3 class="diary-title">📖 日记本</h3>
              <button class="diary-close-btn" id="diary-close">×</button>
            </div>
            <div class="diary-content" id="diary-content">
              <!-- 动态内容将在这里显示 -->
            </div>
          </div>
        </div>
        `;
        
        console.log(`📝 [DiaryUI] HTML结构长度:`, popupHtml.length);
        $('body').append(popupHtml);
        console.log(`✅ [DiaryUI] 弹窗HTML已添加到DOM`);
        console.log(`🔍 [DiaryUI] 检查DOM中的弹窗元素:`, $('#diary-popup').length > 0 ? '存在' : '不存在');
    }

    /**
     * 绑定事件处理器
     */
    bindEvents() {
        const self = this;
        
        // 关闭按钮
        $(document).on('click', '#diary-close', () => {
            self.closeDiary();
        });
        
        // 点击遮罩关闭
        $(document).on('click', '#diary-popup', (e) => {
            if (e.target.id === 'diary-popup') {
                self.closeDiary();
            }
        });
        
        // ESC键关闭
        $(document).on('keydown', (e) => {
            if (e.key === 'Escape' && $('#diary-popup').hasClass('show')) {
                self.closeDiary();
            }
        });
        
        // 阻止弹窗内容点击事件冒泡
        $(document).on('click', '.diary-popup-content', (e) => {
            e.stopPropagation();
        });
    }

    /**
     * 关闭日记弹窗
     */
    closeDiary() {
        $('#diary-popup').removeClass('show');
        setTimeout(() => {
            this.cleanup();
        }, 300);
    }

    /**
     * 显示封面页
     */
    showCover() {
        const totalEntries = Object.values(this.diariesData).reduce((sum, entries) => sum + entries.length, 0);
        const totalCharacters = Object.keys(this.diariesData).length;
        
        const coverHtml = `
        <div class="diary-cover">
          <div class="diary-cover-icon">📖</div>
          <h2 class="diary-cover-title">我的日记本</h2>
          
          <div class="diary-cover-stats">
            <div class="diary-stat-item">
              <span class="diary-stat-number">${totalCharacters}</span>
              <span class="diary-stat-label">位角色</span>
            </div>
            <div class="diary-stat-item">
              <span class="diary-stat-number">${totalEntries}</span>
              <span class="diary-stat-label">篇日记</span>
            </div>
          </div>
          
          <!-- 设置按钮 -->
          <div class="diary-settings-btn" id="diary-settings-btn" title="预设设置">
            <i class="fa-solid fa-cog"></i>
          </div>
        </div>
        `;
        
        $('#diary-content').html(coverHtml);
        
        // 绑定设置按钮事件
        $('#diary-settings-btn').on('click', () => this.showPresetSettings());
        
        // 延迟显示角色列表或空数据提示
        setTimeout(() => {
            if (totalCharacters > 0) {
                this.showCharacterList();
            } else {
                this.showEmptyDataMessage();
            }
        }, 1500);
    }

    /**
     * 显示角色列表
     */
    showCharacterList() {
        let characterListHtml = `
        <div class="diary-character-list">
          <div class="diary-character-grid">
        `;
        
        Object.keys(this.diariesData).forEach(characterName => {
            const entries = this.diariesData[characterName];
            const entryCount = entries.length;
            const latestEntry = entries[0]; // 假设已按时间排序
            const preview = latestEntry ? latestEntry.content.substring(0, 50) + '...' : '暂无内容';
            
            characterListHtml += `
            <div class="diary-character-card" data-character="${characterName}">
              <div class="diary-character-name">${characterName}</div>
              <div class="diary-character-count">${entryCount} 篇日记</div>
              <div class="diary-character-preview">${preview}</div>
            </div>
            `;
        });
        
        characterListHtml += `
          </div>
        </div>
        `;
        
        $('#diary-content').html(characterListHtml);
        
        // 绑定角色卡片点击事件
        $('.diary-character-card').on('click', (e) => {
            const characterName = $(e.currentTarget).data('character');
            this.showCharacterDiaries(characterName);
        });
    }

    /**
     * 显示空数据提示
     */
    showEmptyDataMessage() {
        const emptyHtml = `
        <div class="diary-empty-state">
          <div class="diary-empty-icon">📝</div>
          <div class="diary-empty-title">还没有日记</div>
          <div class="diary-empty-description">
            点击"写日记"按钮开始记录你的生活吧！<br>
            AI会帮助你生成格式化的日记内容。
          </div>
        </div>
        `;
        
        $('#diary-content').html(emptyHtml);
    }

    /**
     * 显示指定角色的日记列表
     * @param {string} characterName 角色名称
     * @param {number} page 页码（从0开始）
     */
    showCharacterDiaries(characterName, page = 0) {
        this.currentCharacter = characterName;
        this.currentEntries = this.diariesData[characterName] || [];
        this.currentPage = page;
        
        console.log(`📖 [DiaryUI] 显示角色日记: ${characterName}, 页码: ${page}`);
        
        this.hideAllPages();
        this.renderEntries(page);
    }

    /**
     * 显示日记详情
     * @param {Object} entry 日记条目
     */
    showDetail(entry) {
        this.currentViewingEntry = entry;
        
        const detailHtml = `
        <div class="diary-detail">
          <div class="diary-detail-header">
            <div class="diary-detail-info">
              <h2 class="diary-detail-title">${entry.title}</h2>
              <div class="diary-detail-time">${entry.time}</div>
            </div>
            <div class="diary-detail-actions">
              <button class="diary-back-btn" id="diary-back-to-list">
                <i class="fa-solid fa-arrow-left"></i> 返回
              </button>
              <button class="diary-delete-btn" id="diary-delete-entry" data-uid="${entry.uid}">
                <i class="fa-solid fa-trash"></i> 删除
              </button>
            </div>
          </div>
          
          <div class="diary-detail-content">${entry.content}</div>
        </div>
        `;
        
        $('#diary-content').html(detailHtml);
        
        // 绑定事件
        $('#diary-back-to-list').on('click', () => {
            this.showCharacterDiaries(this.currentCharacter, this.currentPage);
        });
        
        $('#diary-delete-entry').on('click', () => {
            this.handleDeleteClick(entry);
        });
    }

    /**
     * 隐藏所有页面
     */
    hideAllPages() {
        $('#diary-content').empty();
    }

    /**
     * 更新设置按钮状态
     */
    async updateSettingsButtonStatus() {
        try {
            const isConfigured = await this.presetManager.isPresetConfigured();
            const settingsBtn = $('#diary-settings-btn');
            
            if (isConfigured) {
                settingsBtn.addClass('has-preset').removeClass('no-preset');
                settingsBtn.attr('title', '预设设置 (已配置)');
            } else {
                settingsBtn.addClass('no-preset').removeClass('has-preset');
                settingsBtn.attr('title', '预设设置 (未配置)');
            }
        } catch (error) {
            console.error(`❌ [DiaryUI] 更新设置按钮状态失败:`, error);
        }
    }

    /**
     * 显示预设设置弹窗
     */
    async showPresetSettings() {
        try {
            const currentPreset = await this.presetManager.getCurrentPreset();
            const availablePresets = await this.presetManager.getAvailablePresets();
            const configuredPreset = await this.presetManager.getConfiguredPreset();
            
            const dialogHTML = this.createPresetDialogHTML(currentPreset, availablePresets, configuredPreset);
            
            // 创建自定义弹窗
            const overlayHtml = `
                <div class="diary-preset-overlay" id="diary-preset-overlay">
                  ${dialogHTML}
                </div>
            `;
            
            $('body').append(overlayHtml);
            
            // 绑定事件
            this.bindPresetDialogEvents();
            
        } catch (error) {
            console.error(`❌ [DiaryUI] 显示预设设置失败:`, error);
            toastr.error('显示预设设置失败，请稍后重试', '设置错误');
        }
    }

    /**
     * 创建预设设置对话框HTML
     * @param {string} currentPreset 当前预设
     * @param {Array} availablePresets 可用预设列表
     * @param {string|null} configuredPreset 配置的预设
     * @returns {string} HTML字符串
     */
    createPresetDialogHTML(currentPreset, availablePresets, configuredPreset) {
        let presetOptions = '<option value="">不使用专用预设</option>';
        availablePresets.forEach(preset => {
            const selected = preset === configuredPreset ? 'selected' : '';
            presetOptions += `<option value="${preset}" ${selected}>${preset}</option>`;
        });
        
        return `
        <div class="diary-preset-dialog">
          <div class="diary-preset-header">
            <h3>📋 预设设置</h3>
            <button class="diary-close-btn" id="diary-preset-close">×</button>
          </div>
          
          <div class="diary-preset-content">
            <div class="diary-preset-info">
              <p><strong>当前预设：</strong> ${currentPreset || '无'}</p>
              <p><strong>已配置预设：</strong> ${configuredPreset || '无'}</p>
            </div>
            
            <div class="diary-preset-form">
              <label for="diary-preset-select">选择日记专用预设：</label>
              <select id="diary-preset-select">
                ${presetOptions}
              </select>
              
              <p class="diary-preset-hint">
                💡 选择预设后，写日记时会自动切换到此预设，完成后恢复原预设
              </p>
            </div>
            
            <div class="diary-preset-actions">
              <button id="diary-preset-refresh" class="diary-btn diary-btn-secondary">
                🔄 刷新预设列表
              </button>
              <button id="diary-preset-save" class="diary-btn diary-btn-primary">
                💾 保存设置
              </button>
            </div>
          </div>
        </div>
        `;
    }

    /**
     * 绑定预设对话框事件
     */
    bindPresetDialogEvents() {
        const self = this;
        
        const closeDialog = () => {
            $(document).off('keydown.preset-dialog');
            $('#diary-preset-overlay').remove();
        };
        
        // 点击遮罩层关闭弹窗
        $('#diary-preset-overlay').on('click', e => {
            if (e.target.id === 'diary-preset-overlay') {
                closeDialog();
            }
        });
        
        // ESC 键关闭弹窗
        $(document).on('keydown.preset-dialog', e => {
            if (e.key === 'Escape') {
                closeDialog();
            }
        });
        
        // 关闭按钮
        $('#diary-preset-close').on('click', closeDialog);
        
        // 刷新预设列表
        $('#diary-preset-refresh').on('click', async () => {
            try {
                $('#diary-preset-refresh').prop('disabled', true).text('🔄 刷新中...');
                
                const availablePresets = await self.presetManager.refreshPresetList();
                const configuredPreset = await self.presetManager.getConfiguredPreset();
                
                // 更新下拉框选项
                let presetOptions = '<option value="">不使用专用预设</option>';
                availablePresets.forEach(preset => {
                    const selected = preset === configuredPreset ? 'selected' : '';
                    presetOptions += `<option value="${preset}" ${selected}>${preset}</option>`;
                });
                
                $('#diary-preset-select').html(presetOptions);
                toastr.success('预设列表已刷新', '刷新成功');
                
            } catch (error) {
                console.error(`❌ [DiaryUI] 刷新预设列表失败:`, error);
                toastr.error('刷新预设列表失败', '刷新错误');
            } finally {
                $('#diary-preset-refresh').prop('disabled', false).text('🔄 刷新预设列表');
            }
        });
        
        // 保存设置
        $('#diary-preset-save').on('click', async () => {
            try {
                $('#diary-preset-save').prop('disabled', true).text('💾 保存中...');
                
                const selectedPreset = $('#diary-preset-select').val() || null;
                await self.presetManager.setDiaryPreset(selectedPreset);
                
                toastr.success('预设设置已保存', '保存成功');
                closeDialog();
                
                // 更新设置按钮状态
                await self.updateSettingsButtonStatus();
                
            } catch (error) {
                console.error(`❌ [DiaryUI] 保存预设设置失败:`, error);
                toastr.error('保存预设设置失败', '保存错误');
            } finally {
                $('#diary-preset-save').prop('disabled', false).text('💾 保存设置');
            }
        });
    }

    /**
     * 渲染角色列表
     */
    renderCharacters() {
        // 这个方法已经在 showCharacterList 中实现
        this.showCharacterList();
    }

    /**
     * 渲染日记条目列表
     * @param {number} page 页码
     */
    renderEntries(page) {
        const startIndex = page * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageEntries = this.currentEntries.slice(startIndex, endIndex);
        
        let entriesHtml = `
        <div class="diary-entries">
          <div class="diary-entries-header">
            <div class="diary-character-name">${this.currentCharacter}</div>
            <button class="diary-back-btn" id="diary-back-to-characters">
              <i class="fa-solid fa-arrow-left"></i> 返回角色列表
            </button>
          </div>
          
          <div class="diary-entries-grid">
        `;
        
        pageEntries.forEach(entry => {
            const preview = entry.content.length > 100 
                ? entry.content.substring(0, 100) + '...' 
                : entry.content;
            
            entriesHtml += `
            <div class="diary-entry-card" data-uid="${entry.uid}">
              <div class="diary-entry-title">${entry.title}</div>
              <div class="diary-entry-time">${entry.time}</div>
              <div class="diary-entry-preview">${preview}</div>
              <div class="diary-entry-actions">
                <button class="diary-delete-btn" data-uid="${entry.uid}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
            `;
        });
        
        entriesHtml += `
          </div>
        </div>
        `;
        
        $('#diary-content').html(entriesHtml);
        
        // 渲染分页
        this.renderPagination();
        
        // 绑定事件
        $('#diary-back-to-characters').on('click', () => {
            this.showCharacterList();
        });
        
        $('.diary-entry-card').on('click', (e) => {
            // 如果点击的是删除按钮，不触发详情查看
            if ($(e.target).closest('.diary-delete-btn').length > 0) {
                return;
            }
            
            const uid = $(e.currentTarget).data('uid');
            const entry = this.currentEntries.find(e => e.uid == uid);
            if (entry) {
                this.showDetail(entry);
            }
        });
        
        $('.diary-delete-btn').on('click', (e) => {
            e.stopPropagation();
            const uid = $(e.currentTarget).data('uid');
            const entry = this.currentEntries.find(e => e.uid == uid);
            if (entry) {
                this.handleDeleteClick(entry);
            }
        });
    }

    /**
     * 渲染分页导航
     */
    renderPagination() {
        if (this.currentEntries.length <= this.pageSize) {
            return; // 不需要分页
        }
        
        const totalPages = Math.ceil(this.currentEntries.length / this.pageSize);
        const currentPage = this.currentPage;
        
        let paginationHtml = `
        <div class="diary-pagination">
          <div class="diary-pagination-info">
            第 ${currentPage + 1} 页，共 ${totalPages} 页 (${this.currentEntries.length} 篇日记)
          </div>
          <div class="diary-pagination-controls">
        `;
        
        // 上一页按钮
        const prevDisabled = currentPage === 0 ? 'disabled' : '';
        paginationHtml += `
        <button class="diary-page-btn" id="diary-prev-page" ${prevDisabled}>
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        `;
        
        // 页码按钮
        const startPage = Math.max(0, currentPage - 2);
        const endPage = Math.min(totalPages - 1, currentPage + 2);
        
        if (startPage > 0) {
            paginationHtml += `<button class="diary-page-btn" data-page="0">1</button>`;
            if (startPage > 1) {
                paginationHtml += `<span class="diary-page-ellipsis">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            paginationHtml += `
            <button class="diary-page-btn ${activeClass}" data-page="${i}">
              ${i + 1}
            </button>
            `;
        }
        
        if (endPage < totalPages - 1) {
            if (endPage < totalPages - 2) {
                paginationHtml += `<span class="diary-page-ellipsis">...</span>`;
            }
            paginationHtml += `<button class="diary-page-btn" data-page="${totalPages - 1}">${totalPages}</button>`;
        }
        
        // 下一页按钮
        const nextDisabled = currentPage === totalPages - 1 ? 'disabled' : '';
        paginationHtml += `
        <button class="diary-page-btn" id="diary-next-page" ${nextDisabled}>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        `;
        
        paginationHtml += `
          </div>
        </div>
        `;
        
        $('#diary-content').append(paginationHtml);
        
        // 绑定分页事件
        $('#diary-prev-page').on('click', () => {
            if (currentPage > 0) {
                this.showCharacterDiaries(this.currentCharacter, currentPage - 1);
            }
        });
        
        $('#diary-next-page').on('click', () => {
            if (currentPage < totalPages - 1) {
                this.showCharacterDiaries(this.currentCharacter, currentPage + 1);
            }
        });
        
        $('.diary-page-btn[data-page]').on('click', (e) => {
            const page = parseInt($(e.currentTarget).data('page'));
            this.showCharacterDiaries(this.currentCharacter, page);
        });
    }

    /**
     * 确保删除按钮存在
     */
    ensureDeleteButton() {
        // 这个方法的功能已经集成在 renderEntries 中
    }

    /**
     * 处理删除按钮点击
     * @param {Object} entry 要删除的日记条目
     */
    async handleDeleteClick(entry) {
        try {
            const confirmed = await this.showDeleteConfirmation(entry);
            if (!confirmed) return;
            
            console.log(`🗑️ [DiaryUI] 删除日记条目: ${entry.title}`);
            
            // 显示加载状态
            toastr.info('正在删除日记...', '处理中');
            
            // 执行删除操作
            const success = await this.diaryStorage.deleteDiaryEntry(entry.uid);
            
            if (success) {
                toastr.success('日记删除成功', '删除完成');
                
                // 重新加载数据并刷新界面
                await this.refreshCurrentView();
            } else {
                toastr.error('日记删除失败，请稍后重试', '删除失败');
            }
        } catch (error) {
            console.error(`❌ [DiaryUI] 删除日记失败:`, error);
            toastr.error('删除过程中发生错误', '删除失败');
        }
    }

    /**
     * 刷新当前视图
     */
    async refreshCurrentView() {
        try {
            // 重新加载数据
            this.diariesData = await this.diaryStorage.getAllDiaries();
            
            if (this.currentViewingEntry) {
                // 如果在查看详情，检查条目是否还存在
                const character = this.currentViewingEntry.charName;
                const entries = this.diariesData[character] || [];
                const stillExists = entries.find(e => e.uid === this.currentViewingEntry.uid);
                
                if (!stillExists) {
                    // 条目已删除，返回列表
                    if (entries.length > 0) {
                        this.showCharacterDiaries(character);
                    } else {
                        // 该角色没有日记了，返回角色列表
                        this.showCharacterList();
                    }
                }
            } else if (this.currentCharacter) {
                // 如果在查看角色的日记列表
                const entries = this.diariesData[this.currentCharacter] || [];
                if (entries.length > 0) {
                    // 调整当前页码，确保不超出范围
                    const maxPage = Math.ceil(entries.length / this.pageSize) - 1;
                    const adjustedPage = Math.min(this.currentPage, maxPage);
                    this.showCharacterDiaries(this.currentCharacter, adjustedPage);
                } else {
                    // 该角色没有日记了，返回角色列表
                    this.showCharacterList();
                }
            } else {
                // 在封面或角色列表，重新显示
                this.showCover();
            }
        } catch (error) {
            console.error(`❌ [DiaryUI] 刷新视图失败:`, error);
            toastr.error('刷新界面失败', '界面错误');
        }
    }

    /**
     * 显示删除确认对话框
     * @param {Object} entry 要删除的日记条目
     * @returns {Promise<boolean>} 用户是否确认删除
     */
    async showDeleteConfirmation(entry) {
        return new Promise((resolve) => {
            const confirmHtml = `
            <div class="diary-confirm-overlay" id="diary-confirm-overlay">
              <div class="diary-confirm-dialog">
                <h3>🗑️ 确认删除</h3>
                <p>确定要删除这篇日记吗？</p>
                <div class="diary-confirm-entry">
                  <strong>标题：</strong>${entry.title}<br>
                  <strong>时间：</strong>${entry.time}
                </div>
                <p class="diary-confirm-warning">⚠️ 此操作无法撤销</p>
                <div class="diary-confirm-actions">
                  <button class="diary-btn diary-btn-secondary" id="diary-cancel-delete">取消</button>
                  <button class="diary-btn diary-btn-danger" id="diary-confirm-delete">删除</button>
                </div>
              </div>
            </div>
            `;
            
            $('body').append(confirmHtml);
            
            $('#diary-cancel-delete').on('click', () => {
                $('#diary-confirm-overlay').remove();
                resolve(false);
            });
            
            $('#diary-confirm-delete').on('click', () => {
                $('#diary-confirm-overlay').remove();
                resolve(true);
            });
            
            // ESC键取消
            $(document).on('keydown.delete-confirm', (e) => {
                if (e.key === 'Escape') {
                    $(document).off('keydown.delete-confirm');
                    $('#diary-confirm-overlay').remove();
                    resolve(false);
                }
            });
        });
    }
}
