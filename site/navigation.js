'use strict';

{
  const copy = {
    en: {
      library: 'Match library', room: 'Replay room', llm: 'LLM commander',
      human: 'Human commander', model: 'Model commander', skip: 'Skip to content',
      navigation: 'Main navigation', switchTo: '中文', switchLang: 'zh-CN'
    },
    zh: {
      library: '比赛库', room: '对战效果', llm: 'LLM 指挥对比',
      human: '人类指挥', model: '模型指挥', skip: '跳到正文',
      navigation: '主导航', switchTo: 'English', switchLang: 'en'
    }
  };
  const nav = document.querySelector('header nav');
  const button = document.getElementById('language');
  const links = [...document.querySelectorAll('a[data-nav]')].map(link => ({
    link, url: new URL(link.href)
  }));
  const defaultLanguage = document.documentElement.lang === 'zh-CN' ? 'zh' : 'en';
  const title = document.querySelector('title[data-nav-title]');
  let language;

  function renderLanguage() {
    const requested = new URLSearchParams(location.search).get('lang');
    language = requested === 'zh' || requested === 'en' ? requested : defaultLanguage;
    const labels = copy[language];
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    nav.setAttribute('aria-label', labels.navigation);
    button.textContent = labels.switchTo;
    button.lang = labels.switchLang;
    document.querySelector('.skip').textContent = labels.skip;

    for (const {link, url} of links) {
      url.searchParams.set('lang', language);
      link.href = url.href;
      if (link.dataset.nav) link.textContent = labels[link.dataset.nav];
    }
    if (title) document.title = `${labels[title.dataset.navTitle]} · Replay Archive`;
    document.dispatchEvent(new CustomEvent('site-language-change', {detail: language}));
  }

  button.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('lang', language === 'zh' ? 'en' : 'zh');
    history.replaceState(history.state, '', url);
    renderLanguage();
  });
  window.addEventListener('popstate', renderLanguage);
  renderLanguage();
}
