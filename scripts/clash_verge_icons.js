// Clash Verge Rev 策略组图标与增强脚本
// 自动为策略组注入 MyClash 高清 SVG 图标

const iconBase = 'https://fastly.jsdelivr.net/gh/AIsouler/MyClash@main/Icons/svg/';

const iconMapping = {
  '🚩 节点选择': iconBase + 'Proxy.svg',
  '♻️ 自动选择': iconBase + 'Auto.svg',
  '👋 手动切换': iconBase + 'Static.svg',
  '🖥️ 远程服务': iconBase + 'Server.svg',
  '💬 AI&谷歌': iconBase + 'OpenAI.svg',
  'Telegram': iconBase + 'Telegram.svg',
  'YouTube': iconBase + 'YouTube.svg',
  'X': iconBase + 'Twitter.svg',
  'Facebook': iconBase + 'Meta.svg',
  'TikTok': iconBase + 'TikTok.svg',
  'Spotify': iconBase + 'Spotify.svg',
  'Ⓜ️ 微软服务': iconBase + 'Microsoft.svg',
  '国外流媒体': iconBase + 'Netflix.svg',
  '🛑 广告拦截': iconBase + 'AdBlock.svg',
  '🇭🇰 香港节点 🕹': iconBase + 'HongKong.svg',
  '🇹🇼 台湾节点 🕹': iconBase + 'Taiwan.svg',
  '🇯🇵 日本节点 🕹': iconBase + 'Japan.svg',
  '🇸🇬 新加坡节点 🕹': iconBase + 'Singapore.svg',
  '🇺🇸 美国节点 🕹': iconBase + 'America.svg',
  '🌏 全球节点 🕹': iconBase + 'WorldMap.svg'
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
