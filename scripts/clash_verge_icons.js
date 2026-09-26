// Clash Verge Rev 策略组图标与增强脚本
// 自动为策略组注入高清 SVG / PNG 图标

const iconSvgBase = 'https://fastly.jsdelivr.net/gh/AIsouler/MyClash@main/Icons/svg/';
const iconRepoBase = 'https://raw.githubusercontent.com/LMuniverse/ApexApple_AE1/main/icons/';

const iconMapping = {
  // 核心功能策略组 (SVG)
  '🚩 节点选择': iconSvgBase + 'Proxy.svg',
  '♻️ 自动选择': iconSvgBase + 'Auto.svg',
  '👋 手动切换': iconSvgBase + 'Static.svg',
  '🖥️ 远程服务': iconSvgBase + 'Server.svg',
  '🛑 广告拦截': iconSvgBase + 'AdBlock.svg',

  // 国外应用与流媒体
  '💬 AI&谷歌': iconSvgBase + 'OpenAI.svg',
  'YouTube': iconSvgBase + 'YouTube.svg',
  'Telegram': iconSvgBase + 'Telegram.svg',
  'Spotify': iconSvgBase + 'Spotify.svg',
  'Ⓜ️ 微软服务': iconSvgBase + 'Microsoft.svg',
  '国外流媒体': iconSvgBase + 'Netflix.svg',
  'TikTok': iconSvgBase + 'TikTok.svg',

  // 用户专属定制图标 (PNG)
  'X': iconRepoBase + 'X.png',
  'Facebook': iconRepoBase + 'Facebook.png',
  'Instagram': iconRepoBase + 'Instagram.png',
  'javdb': iconRepoBase + 'JavDB.png',

  // 国内主流媒体 (PNG)
  '抖音': iconRepoBase + 'Douyin.png',
  '小红书': iconRepoBase + 'Xiaohongshu.png',
  '微博': iconRepoBase + 'Weibo.png',
  '快手': iconRepoBase + 'Kuaishou.png',
  '哔哩哔哩': iconRepoBase + 'Bilibili.png',
  '知乎': iconRepoBase + 'Zhihu.png',

  // 地区策略组
  '🇭🇰 香港节点 🕹': iconSvgBase + 'HongKong.svg',
  '🇹🇼 台湾节点 🕹': iconSvgBase + 'Taiwan.svg',
  '🇯🇵 日本节点 🕹': iconSvgBase + 'Japan.svg',
  '🇸🇬 新加坡节点 🕹': iconSvgBase + 'Singapore.svg',
  '🇺🇸 美国节点 🕹': iconSvgBase + 'America.svg',
  '🇰🇷 韩国节点 🕹': iconRepoBase + 'Korea.png',
  '🌏 全球节点 🕹': iconSvgBase + 'WorldMap.svg'
};

function main(config, profileName) {
  if (!config || !Array.isArray(config['proxy-groups'])) {
    return config;
  }

  config['proxy-groups'].forEach((group) => {
    if (group && group.name && iconMapping[group.name]) {
      group.icon = iconMapping[group.name];
    }
  });

  return config;
}
