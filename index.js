/**
 * PicGo多图床备份插件
 * 后台运行，在主图床上传成功后自动备份到其他图床
 */

const multipleBackupPlugin = (ctx) => {
  // 用于缓存图片数据的变量
  let cachedImageData = null
  
  /**
   * 获取当前默认图床
   */
  const getCurrentUploader = () => {
    return ctx.getConfig('picBed.uploader') || ctx.getConfig('picBed.current')
  }
  
  /**
   * 获取所有已配置的图床列表（排除当前默认图床）
   */
  const getConfiguredUploaders = () => {
    try {
      const allUploaders = ctx.helper.uploader.getIdList()
      const currentUploader = getCurrentUploader()
      
      return allUploaders
        .filter((type) => type !== currentUploader && type !== 'multiple-backup') // 排除当前默认图床和自己
        .map((type) => {
          const uploader = ctx.helper.uploader.get(type)
          const config = ctx.getConfig(`picBed.${type}`)
          
          return {
            type,
            name: uploader?.name || type,
            configured: !!config && Object.keys(config).length > 0
          }
        })
        .filter((item) => item.configured) // 只显示已配置的图床
    } catch (error) {
      ctx.log.error('[Multiple Backup] 获取图床列表失败:', error)
      return []
    }
  }

  /**
   * 创建备份上传上下文
   */
  const createBackupContext = (cachedItems, successItems) => {
    // 创建备份上传的上下文，使用缓存的图片数据
    const backupCtx = Object.create(Object.getPrototypeOf(ctx))
    Object.assign(backupCtx, ctx)
    
    // 确保关键方法的this绑定正确
    const methodsToBinds = ['getConfig', 'saveConfig', 'request', 'emit']
    methodsToBinds.forEach(method => {
      if (ctx[method]) {
        backupCtx[method] = ctx[method].bind(ctx)
      }
    })
    
    backupCtx.log = ctx.log || console
    
    // 使用缓存的图片数据，结合成功上传项的文件名信息
    backupCtx.output = cachedItems.map((cachedItem, index) => {
      const successItem = successItems[index]
      return {
        ...cachedItem,
        // 确保使用与成功上传相同的文件名
        fileName: successItem ? successItem.fileName : cachedItem.fileName,
        // 清除URL字段，强制重新上传
        imgUrl: undefined,
        url: undefined
      }
    })
    
    // 确保其他可能需要的属性也被复制
    const propertiesToCopy = ['baseDir', 'configPath', 'helper']
    propertiesToCopy.forEach(prop => {
      if (ctx[prop]) {
        backupCtx[prop] = ctx[prop]
      }
    })
    
    return backupCtx
  }

  /**
   * 设置备份上下文的request方法
   */
  const setupRequestMethod = (backupCtx, uploaderType) => {
    // 验证request方法是否可用
    if (!backupCtx.request || typeof backupCtx.request !== 'function') {
      ctx.log.warn(`[Multiple Backup] ${uploaderType} 上下文缺少request方法，尝试使用备用实现`)
      
      // 尝试使用备用的request实现
      if (ctx.Request && ctx.Request.request) {
        // 旧版本的PicGo使用ctx.Request.request
        backupCtx.request = ctx.Request.request.bind(ctx.Request)
        backupCtx.Request = ctx.Request // 确保Request对象也被复制
        ctx.log.info(`[Multiple Backup] 使用旧版本的ctx.Request.request方法`)
        return true
      } else if (typeof require !== 'undefined') {
        // 如果都没有，尝试直接使用axios
        try {
          const axios = require('axios')
          backupCtx.request = async (options) => {
            const response = await axios(options)
            return response.data
          }
          ctx.log.info(`[Multiple Backup] 使用直接的axios实现`)
          return true
        } catch (error) {
          ctx.log.error(`[Multiple Backup] 无法创建request方法:`, error)
          return false
        }
      } else {
        return false
      }
    }
    return true
  }

  /**
   * 记录调试信息
   */
  const logDebugInfo = (uploaderType, backupCtx) => {
    ctx.log.info(`[Multiple Backup Debug] 备份上下文创建完成，准备调用 ${uploaderType} 上传器`)
    ctx.log.info(`[Multiple Backup Debug] 上下文方法检查: request=${!!backupCtx.request}, getConfig=${!!backupCtx.getConfig}, Request=${!!backupCtx.Request}`)
    
    // 记录输入数据用于对比
    ctx.log.info(`[Multiple Backup Debug] ${uploaderType} 输入数据:`, backupCtx.output.map(item => ({
      fileName: item.fileName,
      buffer: item.buffer ? `Buffer(${item.buffer.length}bytes)` : 'undefined',
      base64Image: item.base64Image ? `Base64(${item.base64Image.length}chars)` : 'undefined'
    })))
  }

  /**
   * 验证备份结果
   */
  const validateBackupResults = (backupCtx, uploaderType) => {
    // 详细记录返回的结果用于调试
    if (backupCtx.output) {
      backupCtx.output.forEach((item, index) => {
        ctx.log.info(`[Multiple Backup Debug] ${uploaderType} 返回项 ${index + 1}:`, {
          fileName: item.fileName,
          imgUrl: item.imgUrl,
          url: item.url,
          hasImgUrl: !!item.imgUrl,
          hasUrl: !!item.url,
          allKeys: Object.keys(item)
        })
      })
    } else {
      ctx.log.error(`[Multiple Backup Debug] ${uploaderType} 没有返回output结果`)
    }
    
    // 检查是否真正上传成功
    const hasValidResults = backupCtx.output && 
                           backupCtx.output.length > 0 && 
                           backupCtx.output.some(item => item.imgUrl || item.url)

    if (!hasValidResults) {
      throw new Error(`${uploaderType} 上传未返回有效的URL`)
    }

    // 记录成功的上传结果
    backupCtx.output.forEach((item, index) => {
      if (item.imgUrl || item.url) {
        ctx.log.info(`[Multiple Backup Debug] ${uploaderType} 文件 ${index + 1}: ${item.imgUrl || item.url}`)
      }
    })
  }

  /**
   * 备份上传到指定图床
   */
  const backupUploadToUploader = async (uploaderType, cachedItems, successItems) => {
    try {
      const uploader = ctx.helper.uploader.get(uploaderType)
      if (!uploader) {
        throw new Error(`未找到上传器: ${uploaderType}`)
      }

      ctx.log.info(`[Multiple Backup Debug] 开始备份到 ${uploaderType}，使用缓存数据:`, cachedItems.length, '个文件')

      // 创建备份上传上下文
      const backupCtx = createBackupContext(cachedItems, successItems)

      // 设置request方法
      if (!setupRequestMethod(backupCtx, uploaderType)) {
        throw new Error(`${uploaderType} 上传器需要HTTP请求方法，但无法找到可用的实现`)
      }

      // 记录调试信息
      logDebugInfo(uploaderType, backupCtx)

      // 执行备份上传
      await uploader.handle(backupCtx)

      ctx.log.info(`[Multiple Backup Debug] ${uploaderType} 上传器执行完成，结果:`, backupCtx.output?.length || 0, '个文件')
      
      // 验证备份结果
      validateBackupResults(backupCtx, uploaderType)

      return {
        uploader: uploaderType,
        success: true,
        results: backupCtx.output
      }
    } catch (error) {
      ctx.log.error(`[Multiple Backup] 备份到 ${uploaderType} 失败:`, error)
      return {
        uploader: uploaderType, 
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 执行备份上传
   */
  const performBackupUpload = async (ctx) => {
    const config = ctx.getConfig('picgo-plugin-multiple-backup')
    
    // 早期退出检查
    if (!config?.backupUploaders || config.backupUploaders.length === 0) {
      if (config?.enableLog) {
        ctx.log.info('[Multiple Backup] 未配置备份图床，跳过备份')
      }
      return
    }

    if (!cachedImageData || cachedImageData.length === 0) {
      ctx.log.error('[Multiple Backup] 缓存的图片数据不存在，无法进行备份')
      return
    }

    if (!ctx.output || ctx.output.length === 0 || !ctx.output.some(item => item.imgUrl)) {
      if (config?.enableLog) {
        ctx.log.info('[Multiple Backup] 主图床上传失败，跳过备份')
      }
      cachedImageData = null // 清理缓存
      return
    }

    const currentUploader = getCurrentUploader()
    
    ctx.log.info(`[Multiple Backup] 主图床 ${currentUploader} 上传成功，开始备份到 ${config.backupUploaders.length} 个图床`)
    
    // 记录调试信息
    if (config?.enableLog) {
      ctx.output.forEach((item, index) => {
        ctx.log.info(`[Multiple Backup Debug] 原始文件 ${index + 1}: ${item.fileName} -> ${item.imgUrl}`)
      })
      
      cachedImageData.forEach((item, index) => {
        ctx.log.info(`[Multiple Backup Debug] 缓存数据 ${index + 1}: ${item.fileName}, buffer: ${item.buffer ? 'available' : 'missing'}`)
      })
    }

    try {
      // 并发执行所有备份上传
      const backupPromises = config.backupUploaders.map(uploaderType => 
        backupUploadToUploader(uploaderType, cachedImageData, ctx.output)
      )
      
      const results = await Promise.allSettled(backupPromises)
      const successCount = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length

      ctx.log.info(`[Multiple Backup] 备份完成: ${successCount}/${config.backupUploaders.length} 个成功`)
      
      // 记录备份结果
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          const { uploader, success, results: uploadResults } = result.value
          if (success) {
            ctx.log.info(`[Multiple Backup] ✅ ${uploader} 备份成功`)
            if (uploadResults && uploadResults.length > 0) {
              uploadResults.forEach((item, index) => {
                ctx.log.info(`[Multiple Backup] ${uploader} 结果 ${index + 1}: ${item.imgUrl || item.url || '无URL'}`)
              })
            }
          } else {
            ctx.log.error(`[Multiple Backup] ❌ ${uploader} 备份失败: ${result.value.error}`)
          }
        } else {
          ctx.log.error(`[Multiple Backup] ❌ 备份异常:`, result.reason)
        }
      })
    } catch (error) {
      ctx.log.error('[Multiple Backup] 备份过程异常:', error)
    } finally {
      // 清理缓存数据，避免内存泄漏
      cachedImageData = null
      ctx.log.info('[Multiple Backup Debug] 缓存数据已清理')
    }
  }

  /**
   * 注册插件
   */
  const register = () => {
    // 1. 在beforeUploadPlugins阶段缓存图片数据
    ctx.helper.beforeUploadPlugins.register('multiple-backup-cache', {
      handle: async (ctx) => {
        const config = ctx.getConfig('picgo-plugin-multiple-backup')
        
        // 只有配置了备份图床时才进行缓存
        if (config?.backupUploaders && config.backupUploaders.length > 0) {
          // 深拷贝图片数据以避免引用问题
          cachedImageData = ctx.output.map(item => ({
            ...item,
            // 确保缓存原始的buffer数据
            buffer: item.buffer ? Buffer.from(item.buffer) : null,
            base64Image: item.base64Image ? item.base64Image : null
          }))
          
          ctx.log.info(`[Multiple Backup Debug] 图片数据已缓存: ${cachedImageData.length} 个文件`)
          cachedImageData.forEach((item, index) => {
            ctx.log.info(`[Multiple Backup Debug] 缓存文件 ${index + 1}: ${item.fileName}, buffer: ${item.buffer ? `${item.buffer.length}bytes` : 'missing'}`)
          })
        }
      }
    })

    // 2. 在afterUploadPlugins阶段使用缓存数据进行备份
    ctx.helper.afterUploadPlugins.register('multiple-backup', {
      handle: async (ctx) => {
        // 在主图床上传成功后执行备份
        await performBackupUpload(ctx)
      }
    })
  }

  /**
   * 插件配置界面
   */
  const config = () => {
    const configuredUploaders = getConfiguredUploaders()
    const currentUploader = getCurrentUploader()
    
    if (configuredUploaders.length === 0) {
      return [
        {
          name: 'notice',
          type: 'input',
          default: `当前默认图床：${currentUploader}。请先在"图床设置"中配置其他图床作为备份，然后重新打开此配置页面。`,
          required: false,
          message: '配置提示'
        }
      ]
    }

    const choices = configuredUploaders.map((item) => ({
      name: `${item.name} (${item.type})`,
      value: item.type
    }))

    return [
      {
        name: 'currentUploaderDisplay',
        type: 'list',
        choices: [{ name: `${currentUploader} (当前默认图床)`, value: currentUploader }],
        default: currentUploader,
        required: false,
        message: '图床信息'
      },
      {
        name: 'backupUploaders',
        type: 'checkbox',
        choices: choices,
        message: '选择备份图床（可多选）',
        default: [],
        required: false
      },
      {
        name: 'enableLog',
        type: 'confirm',
        default: true,
        message: '启用详细日志（推荐开启，用于调试）',
        required: false
      }
    ]
  }

  return {
    register,
    config
  }
}

module.exports = multipleBackupPlugin