/**
 * 页面加载时从 GitHub API 读取最新 Star 数，更新所有
 * [data-repo] 内的 .star-count。结果缓存 1 小时；接口失败时
 * 保留页面上的静态回退值。
 */
(function () {
  'use strict';

  var USER = 'lvsir18';
  var API = 'https://api.github.com/users/' + USER;
  var CACHE_KEY = 'gh-star-counts:v1:' + USER;
  var CACHE_TTL = 60 * 60 * 1000; // 1 小时

  var targets = document.querySelectorAll('[data-repo]');
  if (!targets.length) return;

  var formatter = new Intl.NumberFormat('en-US');

  var canStore = (function () {
    try {
      localStorage.setItem('__star_test__', '1');
      localStorage.removeItem('__star_test__');
      return true;
    } catch (e) {
      return false;
    }
  })();

  function apply(counts) {
    Array.prototype.forEach.call(targets, function (el) {
      var repo = el.getAttribute('data-repo');
      if (!repo) return;
      var count = counts[repo.toLowerCase()];
      if (typeof count !== 'number') return;
      var out = el.querySelector('.star-count');
      if (out) out.textContent = formatter.format(count);
    });
  }

  function readCache() {
    if (!canStore) return null;
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.time !== 'number' || !parsed.counts) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeCache(counts) {
    if (!canStore) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), counts: counts }));
    } catch (e) {}
  }

  function fetchPage(url, page) {
    var joiner = url.indexOf('?') === -1 ? '?' : '&';
    return fetch(url + joiner + 'page=' + page, {
      headers: { Accept: 'application/vnd.github+json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('GitHub API ' + res.status);
      return res.json();
    }).then(function (data) {
      if (!Array.isArray(data) || data.length < 100 || page >= 5) return data || [];
      return fetchPage(url, page + 1).then(function (next) {
        return data.concat(next);
      });
    });
  }

  function collect(counts, list) {
    (list || []).forEach(function (repo) {
      if (!repo || !repo.full_name || typeof repo.stargazers_count !== 'number') return;
      counts[repo.full_name.toLowerCase()] = repo.stargazers_count;
    });
  }

  var cached = readCache();
  if (cached) {
    apply(cached.counts);
    if (Date.now() - cached.time < CACHE_TTL) return;
  }

  Promise.all([
    fetchPage(API + '/starred?per_page=100', 1).catch(function () { return null; }),
    fetchPage(API + '/repos?per_page=100&sort=updated', 1).catch(function () { return null; })
  ]).then(function (results) {
    var counts = cached ? Object.assign({}, cached.counts) : {};
    var received = 0;

    results.forEach(function (list) {
      if (!list) return;
      received += 1;
      collect(counts, list);
    });

    if (!received) return;
    apply(counts);
    writeCache(counts);
  });
})();
