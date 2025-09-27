/**
 * 日记存储模块
 * 负责与SillyTavern的WorldBook系统交互，管理日记数据的CRUD操作
 */

// 日记条目接口定义
export class DiaryEntry {
    constructor(uid, title, time, content, charName) {
        this.uid = uid;
        this.title = title;
        this.time = time;
        this.content = content;
        this.charName = charName;
    }
}

export class DiaryStorage {
    constructor(worldbookName) {
        this.worldbookName = worldbookName;
        this.initialized = false;
    }

    /**
     * 更新世界书名称
     * @param {string} newName 新的世界书名称
     */
    updateWorldbookName(newName) {
        this.worldbookName = newName;
        console.log(`📚 [DiaryStorage] 世界书名称已更新为: ${newName}`);
    }

    /**
     * 确保世界书存在，如果不存在则创建
     */
    async ensureWorldbook() {
        try {
            console.log(`📚 [DiaryStorage] 确保世界书存在: ${this.worldbookName}`);
            
            // 使用SillyTavern的slash命令获取或创建世界书
            const result = await this.executeSlashCommand(`/getchatbook name="${this.worldbookName}"`);
            
            if (result) {
                console.log(`✅ [DiaryStorage] 世界书已存在或创建成功: ${this.worldbookName}`);
                this.initialized = true;
                return true;
            } else {
                console.warn(`⚠️ [DiaryStorage] 世界书创建可能失败: ${this.worldbookName}`);
                return false;
            }
        } catch (error) {
            console.error(`❌ [DiaryStorage] 确保世界书存在失败:`, error);
            throw new Error(`世界书初始化失败: ${error.message}`);
        }
    }

    /**
     * 获取所有日记数据，按角色分组
     * @returns {Promise<Object>} 按角色分组的日记数据
     */
    async getAllDiaries() {
        try {
            if (!this.initialized) {
                await this.ensureWorldbook();
            }

            console.log(`📚 [DiaryStorage] 获取所有日记数据...`);
            
            // 获取世界书中的所有条目
            const entries = await this.getAllWorldbookEntries();
            
            // 过滤日记条目并按角色分组
            const diariesByCharacter = this.groupEntriesByCharacter(entries);
            
            console.log(`✅ [DiaryStorage] 获取到日记数据，角色数: ${Object.keys(diariesByCharacter).length}`);
            return diariesByCharacter;
            
        } catch (error) {
            console.error(`❌ [DiaryStorage] 获取日记数据失败:`, error);
            throw new Error(`获取日记数据失败: ${error.message}`);
        }
    }

    /**
     * 创建新的日记条目
     * @param {string} title 日记标题
     * @param {string} time 日记时间
     * @param {string} content 日记内容
     * @param {string} charName 角色名称
     * @param {string} customCharName 自定义角色名（可选）
     * @returns {Promise<boolean>} 是否创建成功
     */
    async createDiaryEntry(title, time, content, charName, customCharName = null) {
        try {
            if (!this.initialized) {
                await this.ensureWorldbook();
            }

            // 验证日记内容
            this.validateDiaryEntry({ title, time, content, charName });

            const finalCharName = customCharName || charName;
            const entryName = `${title}-${time}`;
            
            console.log(`📚 [DiaryStorage] 创建日记条目: ${entryName}, 角色: ${finalCharName}`);

            // 检查条目是否已存在
            const existingEntry = await this.findExistingEntry(entryName, finalCharName);
            if (existingEntry) {
                console.warn(`⚠️ [DiaryStorage] 日记条目已存在: ${entryName}`);
                return false;
            }

            // 创建新条目
            const createResult = await this.executeSlashCommand(
                `/createentry file="${this.worldbookName}" key="${finalCharName}" ${content}`
            );

            if (!createResult) {
                throw new Error('创建条目失败，未收到有效响应');
            }

            const uid = createResult.trim();
            
            // 设置条目名称（标题-时间）
            await this.executeSlashCommand(
                `/setentryfield file="${this.worldbookName}" uid="${uid}" field="comment" ${entryName}`
            );

            console.log(`✅ [DiaryStorage] 日记条目创建成功: ${entryName} (UID: ${uid})`);
            return true;

        } catch (error) {
            console.error(`❌ [DiaryStorage] 创建日记条目失败:`, error);
            throw new Error(`创建日记失败: ${error.message}`);
        }
    }

    /**
     * 删除日记条目
     * @param {string|number} uid 条目UID
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteDiaryEntry(uid) {
        try {
            console.log(`📚 [DiaryStorage] 删除日记条目: ${uid}`);

            // 获取条目信息用于日志
            let entryInfo = '';
            try {
                const comment = await this.executeSlashCommand(
                    `/getentryfield file="${this.worldbookName}" field="comment" ${uid}`
                );
                entryInfo = comment ? ` (${comment})` : '';
            } catch (e) {
                // 获取信息失败不影响删除操作
            }

            // 执行删除操作
            // 注意：SillyTavern 可能没有直接的删除条目命令，需要通过设置内容为空或其他方式
            await this.executeSlashCommand(
                `/setentryfield file="${this.worldbookName}" uid="${uid}" field="content" ""`
            );
            
            // 设置条目为禁用状态
            await this.executeSlashCommand(
                `/setentryfield file="${this.worldbookName}" uid="${uid}" field="disable" 1`
            );

            console.log(`✅ [DiaryStorage] 日记条目删除成功: ${uid}${entryInfo}`);
            return true;

        } catch (error) {
            console.error(`❌ [DiaryStorage] 删除日记条目失败:`, error);
            throw new Error(`删除日记失败: ${error.message}`);
        }
    }

    /**
     * 执行SillyTavern slash命令
     * @param {string} command 要执行的命令
     * @returns {Promise<string>} 命令执行结果
     */
    async executeSlashCommand(command) {
        try {
            // 使用全局的triggerSlash函数
            if (typeof triggerSlash === 'function') {
                const result = await triggerSlash(command);
                return result;
            } else if (window.triggerSlash) {
                const result = await window.triggerSlash(command);
                return result;
            } else {
                throw new Error('triggerSlash函数不可用');
            }
        } catch (error) {
            console.error(`❌ [DiaryStorage] 命令执行失败: ${command}`, error);
            throw error;
        }
    }

    /**
     * 获取世界书中的所有条目
     * @returns {Promise<Array>} 所有条目数组
     */
    async getAllWorldbookEntries() {
        try {
            // 由于SillyTavern API限制，这里需要采用其他方式获取所有条目
            // 可能需要遍历已知的角色名称或使用其他API
            
            // 暂时返回空数组，实际实现需要根据SillyTavern的具体API
            console.warn(`⚠️ [DiaryStorage] getAllWorldbookEntries 需要实现具体的API调用`);
            return [];
        } catch (error) {
            console.error(`❌ [DiaryStorage] 获取世界书条目失败:`, error);
            return [];
        }
    }

    /**
     * 查找已存在的条目
     * @param {string} entryName 条目名称
     * @param {string} charName 角色名称
     * @returns {Promise<Object|null>} 找到的条目或null
     */
    async findExistingEntry(entryName, charName) {
        try {
            // 使用findentry命令查找条目
            const uid = await this.executeSlashCommand(
                `/findentry file="${this.worldbookName}" field="comment" ${entryName}`
            );
            
            if (uid && uid.trim()) {
                // 验证条目是否属于指定角色
                const key = await this.executeSlashCommand(
                    `/getentryfield file="${this.worldbookName}" field="key" ${uid.trim()}`
                );
                
                if (key && key.includes(charName)) {
                    return { uid: uid.trim(), key, entryName };
                }
            }
            
            return null;
        } catch (error) {
            console.error(`❌ [DiaryStorage] 查找条目失败:`, error);
            return null;
        }
    }

    /**
     * 按角色分组条目
     * @param {Array} entries 条目数组
     * @returns {Object} 按角色分组的条目对象
     */
    groupEntriesByCharacter(entries) {
        const grouped = {};
        
        entries.forEach(entry => {
            try {
                const diaryEntry = this.parseEntryToDiaryEntry(entry);
                if (diaryEntry) {
                    if (!grouped[diaryEntry.charName]) {
                        grouped[diaryEntry.charName] = [];
                    }
                    grouped[diaryEntry.charName].push(diaryEntry);
                }
            } catch (error) {
                console.error(`❌ [DiaryStorage] 解析条目失败:`, entry, error);
            }
        });

        // 排序每个角色的日记条目（按时间倒序）
        Object.keys(grouped).forEach(charName => {
            grouped[charName].sort((a, b) => {
                // 这里可以实现更复杂的时间排序逻辑
                return b.time.localeCompare(a.time);
            });
        });

        return grouped;
    }

    /**
     * 将世界书条目解析为日记条目
     * @param {Object} entry 世界书条目
     * @returns {DiaryEntry|null} 日记条目或null
     */
    parseEntryToDiaryEntry(entry) {
        try {
            if (!entry || !entry.comment || !entry.key || !entry.content) {
                return null;
            }

            // 解析条目名称（标题-时间）
            const { title, time } = this.parseDiaryName(entry.comment);
            if (!title || !time) {
                return null;
            }

            // 获取角色名称（从关键词中）
            const charName = this.getCharacterName(entry);
            if (!charName) {
                return null;
            }

            // 检查是否是模板内容
            if (this.isTemplateContent(title, time, entry.content)) {
                return null;
            }

            return new DiaryEntry(
                entry.uid || entry.id,
                title,
                time,
                entry.content,
                charName
            );
        } catch (error) {
            console.error(`❌ [DiaryStorage] 解析日记条目失败:`, error);
            return null;
        }
    }

    /**
     * 解析日记名称（标题-时间格式）
     * @param {string} name 条目名称
     * @returns {Object} 解析结果 {title, time}
     */
    parseDiaryName(name) {
        if (!name || typeof name !== 'string') {
            return { title: null, time: null };
        }

        // 查找最后一个 "-" 作为分隔符
        const lastDashIndex = name.lastIndexOf('-');
        if (lastDashIndex === -1 || lastDashIndex === 0 || lastDashIndex === name.length - 1) {
            return { title: null, time: null };
        }

        const title = name.substring(0, lastDashIndex).trim();
        const time = name.substring(lastDashIndex + 1).trim();

        return { title, time };
    }

    /**
     * 从条目中获取角色名称
     * @param {Object} entry 世界书条目
     * @returns {string|null} 角色名称
     */
    getCharacterName(entry) {
        if (!entry.key) {
            return null;
        }

        // key可能是字符串或数组
        let keys;
        if (typeof entry.key === 'string') {
            keys = entry.key.split(',').map(k => k.trim());
        } else if (Array.isArray(entry.key)) {
            keys = entry.key;
        } else {
            return null;
        }

        // 返回第一个非空的key作为角色名
        return keys.find(key => key && key.length > 0) || null;
    }

    /**
     * 检查是否是模板内容
     * @param {string} title 标题
     * @param {string} time 时间
     * @param {string} content 内容
     * @returns {boolean} 是否是模板内容
     */
    isTemplateContent(title, time, content) {
        // 检查是否包含未替换的模板标记
        const templateMarkers = ['{{标题}}', '{{时间}}', '{{内容}}', '{{char}}'];
        const textToCheck = `${title} ${time} ${content}`.toLowerCase();
        
        return templateMarkers.some(marker => 
            textToCheck.includes(marker.toLowerCase())
        );
    }

    /**
     * 验证日记条目数据
     * @param {Object} entry 要验证的条目数据
     * @throws {Error} 验证失败时抛出错误
     */
    validateDiaryEntry(entry) {
        if (!entry.title || !entry.time || !entry.content) {
            throw new Error('日记标题、时间、内容不能为空');
        }

        if (typeof entry.title !== 'string' || typeof entry.time !== 'string' || typeof entry.content !== 'string') {
            throw new Error('日记数据类型不正确');
        }

        if (entry.title.length > 100) {
            throw new Error('日记标题过长（最大100字符）');
        }

        if (entry.content.length > 5000) {
            throw new Error('日记内容过长（最大5000字符）');
        }

        if (entry.title.includes('-')) {
            throw new Error('日记标题不能包含 "-" 字符');
        }
    }

    /**
     * 获取存储统计信息
     * @returns {Promise<Object>} 统计信息
     */
    async getStorageStats() {
        try {
            const diariesData = await this.getAllDiaries();
            const totalCharacters = Object.keys(diariesData).length;
            const totalEntries = Object.values(diariesData).reduce((sum, entries) => sum + entries.length, 0);

            return {
                totalCharacters,
                totalEntries,
                worldbookName: this.worldbookName,
                initialized: this.initialized
            };
        } catch (error) {
            console.error(`❌ [DiaryStorage] 获取统计信息失败:`, error);
            return {
                totalCharacters: 0,
                totalEntries: 0,
                worldbookName: this.worldbookName,
                initialized: this.initialized,
                error: error.message
            };
        }
    }
}
