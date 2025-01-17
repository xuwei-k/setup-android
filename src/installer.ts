import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'
import * as toolCache from '@actions/tool-cache'
import {
  ANDROID_HOME_DIR,
  ANDROID_SDK_ROOT,
  COMMANDLINE_TOOLS_LINUX_URL,
  COMMANDLINE_TOOLS_MAC_URL,
  COMMANDLINE_TOOLS_WINDOWS_URL
} from './constants'
import {restoreCache} from './cache'

export async function getAndroidSdk(
  sdkVersion: string,
  buildToolsVersion: string,
  ndkVersion: string,
  cmakeVersion: string,
  cacheDisabled: boolean
): Promise<void> {
  if (!cacheDisabled) {
    const restoreCacheEntry = await restoreCache(
      sdkVersion,
      buildToolsVersion,
      ndkVersion,
      cmakeVersion
    )
    if (restoreCacheEntry) {
      return Promise.resolve()
    }
  }

  // download sdk-tools
  core.info(`downloading cmdline-tools ...`)
  fs.mkdirSync(ANDROID_HOME_DIR, {recursive: true})

  let cmdlineToolsDownloadUrl: string
  switch (process.platform) {
    case 'win32':
      cmdlineToolsDownloadUrl = COMMANDLINE_TOOLS_WINDOWS_URL
      break
    case 'darwin':
      cmdlineToolsDownloadUrl = COMMANDLINE_TOOLS_MAC_URL
      break
    case 'linux':
      cmdlineToolsDownloadUrl = COMMANDLINE_TOOLS_LINUX_URL
      break
    default:
      throw Error(`Unsupported platform: ${process.platform}`)
  }
  const downloadedCmdlineToolsPath = await toolCache.downloadTool(
    cmdlineToolsDownloadUrl
  )
  const extractedCmdlineToolPath = await toolCache.extractZip(
    downloadedCmdlineToolsPath
  )
  const sdkManagerBin = path.join(
    extractedCmdlineToolPath,
    'cmdline-tools',
    'bin'
  )
  core.addPath(sdkManagerBin)
  core.info(`downloaded cmdline-tools`)

  // install android sdk
  core.info(`installing ...`)
  // https://github.com/actions/toolkit/issues/359 pipes workaround
  switch (process.platform) {
    case 'win32':
      await exec.exec(
        `cmd /c "yes | sdkmanager --licenses --sdk_root=${ANDROID_SDK_ROOT}"`
      )
      break
    case 'darwin':
      await exec.exec(
        `/bin/bash -c "yes | sdkmanager --licenses --sdk_root=${ANDROID_SDK_ROOT}"`
      )
      break
    case 'linux':
      await exec.exec(
        `/bin/bash -c "yes | sdkmanager --licenses --sdk_root=${ANDROID_SDK_ROOT}"`
      )
      break
    default:
      throw Error(`Unsupported platform: ${process.platform}`)
  }

  await exec.exec('sdkmanager', [
    `build-tools;${buildToolsVersion}`,
    `--sdk_root=${ANDROID_SDK_ROOT}`
  ])
  await exec.exec('sdkmanager', [
    `platform-tools`,
    `--sdk_root=${ANDROID_SDK_ROOT}`,
    '--verbose'
  ])
  await exec.exec('sdkmanager', [
    `platforms;android-${sdkVersion}`,
    `--sdk_root=${ANDROID_SDK_ROOT}`,
    '--verbose'
  ])
  if (cmakeVersion) {
    await exec.exec('sdkmanager', [
      `cmake;${cmakeVersion}`,
      `--sdk_root=${ANDROID_SDK_ROOT}`,
      '--verbose'
    ])
  }
  if (ndkVersion) {
    await exec.exec('sdkmanager', [
      `ndk;${ndkVersion}`,
      `--sdk_root=${ANDROID_SDK_ROOT}`,
      '--verbose'
    ])
  }
  core.info(`installed`)
}
