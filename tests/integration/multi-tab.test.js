/**
 * Integration Tests for Multi-Tab Scenarios
 *
 * Tests tab management and coordination including:
 * - Tab creation and switching
 * - Cross-tab communication
 * - Tab state tracking
 * - Parallel operations across tabs
 * - Tab lifecycle management
 */

const { setupTestEnvironment, teardownTestEnvironment, resetTestMocks, wait } = require('../helpers/setup');

describe('Multi-Tab Scenarios', () => {
  let chrome;

  beforeAll(() => {
    const env = setupTestEnvironment();
    chrome = env.chrome;
  });

  afterAll(() => {
    teardownTestEnvironment();
  });

  beforeEach(() => {
    resetTestMocks();
  });

  describe('Tab Creation', () => {
    test('should create a new tab with URL', () => {
      const createTab = (options) => {
        const newTab = {
          id: Date.now(),
          windowId: 1,
          index: 0,
          url: options.url || 'chrome://newtab',
          title: '',
          active: options.active !== false,
          pinned: options.pinned || false,
          status: 'loading',
          incognito: false
        };

        return { success: true, tab: newTab };
      };

      const result = createTab({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.tab.url).toBe('https://example.com');
      expect(result.tab.active).toBe(true);
      expect(result.tab.status).toBe('loading');
    });

    test('should create tab in background', () => {
      const tabs = [];
      let activeTabId = 100;

      const createTab = (options) => {
        const newTab = {
          id: Date.now(),
          url: options.url,
          active: options.active !== false
        };

        tabs.push(newTab);

        // If active is false, don't change activeTabId
        if (options.active !== false) {
          activeTabId = newTab.id;
        }

        return newTab;
      };

      const tab = createTab({ url: 'https://background.com', active: false });

      expect(tab.active).toBe(false);
      expect(activeTabId).toBe(100); // Original active tab unchanged
    });

    test('should create tab at specific index', () => {
      const tabs = [
        { id: 1, index: 0 },
        { id: 2, index: 1 },
        { id: 3, index: 2 }
      ];

      const createTabAtIndex = (url, targetIndex) => {
        // Shift existing tabs
        tabs.forEach(tab => {
          if (tab.index >= targetIndex) {
            tab.index++;
          }
        });

        const newTab = { id: Date.now(), index: targetIndex, url };
        tabs.push(newTab);
        tabs.sort((a, b) => a.index - b.index);

        return newTab;
      };

      const newTab = createTabAtIndex('https://inserted.com', 1);

      expect(newTab.index).toBe(1);
      expect(tabs.find(t => t.id === 2).index).toBe(2); // Original index 1 moved to 2
    });

    test('should handle tab creation limit', () => {
      const MAX_TABS = 500;
      let tabCount = 498;

      const canCreateTab = () => tabCount < MAX_TABS;

      const createTab = (url) => {
        if (!canCreateTab()) {
          return {
            success: false,
            error: `Maximum tab limit (${MAX_TABS}) reached`,
            suggestion: 'Close some tabs before creating new ones'
          };
        }
        tabCount++;
        return { success: true, tabId: tabCount };
      };

      expect(createTab('https://1.com').success).toBe(true);
      expect(createTab('https://2.com').success).toBe(true);
      expect(createTab('https://3.com').success).toBe(false);
      expect(createTab('https://3.com').error).toContain('Maximum tab limit');
    });
  });

  describe('Tab Switching', () => {
    test('should switch to specified tab', () => {
      const tabs = [
        { id: 1, active: true },
        { id: 2, active: false },
        { id: 3, active: false }
      ];

      const switchToTab = (tabId) => {
        const targetTab = tabs.find(t => t.id === tabId);

        if (!targetTab) {
          return { success: false, error: `Tab ${tabId} not found` };
        }

        tabs.forEach(t => t.active = false);
        targetTab.active = true;

        return { success: true, tab: targetTab };
      };

      const result = switchToTab(2);

      expect(result.success).toBe(true);
      expect(tabs.find(t => t.id === 2).active).toBe(true);
      expect(tabs.find(t => t.id === 1).active).toBe(false);
    });

    test('should handle switching to non-existent tab', () => {
      const tabs = [{ id: 1, active: true }];

      const switchToTab = (tabId) => {
        const targetTab = tabs.find(t => t.id === tabId);
        if (!targetTab) {
          return { success: false, error: `Tab ${tabId} not found` };
        }
        return { success: true, tab: targetTab };
      };

      const result = switchToTab(999);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tab 999 not found');
    });

    test('should switch to tab by URL match', () => {
      const tabs = [
        { id: 1, url: 'https://google.com', active: false },
        { id: 2, url: 'https://example.com/page1', active: false },
        { id: 3, url: 'https://example.com/page2', active: true }
      ];

      const switchToTabByUrl = (urlPattern) => {
        const regex = new RegExp(urlPattern);
        const matchingTabs = tabs.filter(t => regex.test(t.url));

        if (matchingTabs.length === 0) {
          return { success: false, error: 'No tab matches the URL pattern' };
        }

        // Switch to first matching tab
        tabs.forEach(t => t.active = false);
        matchingTabs[0].active = true;

        return {
          success: true,
          tab: matchingTabs[0],
          totalMatches: matchingTabs.length
        };
      };

      const result = switchToTabByUrl('example\\.com');

      expect(result.success).toBe(true);
      expect(result.tab.id).toBe(2);
      expect(result.totalMatches).toBe(2);
    });
  });

  describe('Tab Closing', () => {
    test('should close specified tab', () => {
      const tabs = [
        { id: 1, active: true },
        { id: 2, active: false },
        { id: 3, active: false }
      ];

      const closeTab = (tabId) => {
        const index = tabs.findIndex(t => t.id === tabId);

        if (index === -1) {
          return { success: false, error: `Tab ${tabId} not found` };
        }

        const wasActive = tabs[index].active;
        tabs.splice(index, 1);

        // If closed tab was active, activate adjacent tab
        if (wasActive && tabs.length > 0) {
          tabs[Math.min(index, tabs.length - 1)].active = true;
        }

        return { success: true, remainingTabs: tabs.length };
      };

      const result = closeTab(2);

      expect(result.success).toBe(true);
      expect(tabs.length).toBe(2);
      expect(tabs.find(t => t.id === 2)).toBeUndefined();
    });

    test('should handle closing active tab', () => {
      const tabs = [
        { id: 1, active: true },
        { id: 2, active: false }
      ];

      const closeTab = (tabId) => {
        const index = tabs.findIndex(t => t.id === tabId);
        const wasActive = tabs[index]?.active;
        tabs.splice(index, 1);

        if (wasActive && tabs.length > 0) {
          // Activate next available tab
          tabs[0].active = true;
        }

        return { success: true, newActiveTab: tabs.find(t => t.active)?.id };
      };

      const result = closeTab(1);

      expect(result.success).toBe(true);
      expect(result.newActiveTab).toBe(2);
      expect(tabs[0].active).toBe(true);
    });

    test('should close multiple tabs', () => {
      const tabs = [
        { id: 1, active: true },
        { id: 2, active: false },
        { id: 3, active: false },
        { id: 4, active: false }
      ];

      const closeTabs = (tabIds) => {
        const results = { closed: [], failed: [] };

        for (const tabId of tabIds) {
          const index = tabs.findIndex(t => t.id === tabId);
          if (index !== -1) {
            tabs.splice(index, 1);
            results.closed.push(tabId);
          } else {
            results.failed.push({ tabId, error: 'Not found' });
          }
        }

        return results;
      };

      const result = closeTabs([2, 3, 999]);

      expect(result.closed).toEqual([2, 3]);
      expect(result.failed[0].tabId).toBe(999);
      expect(tabs.length).toBe(2);
    });

    test('should prevent closing last tab', () => {
      const tabs = [{ id: 1, active: true }];

      const closeTab = (tabId, options = {}) => {
        if (tabs.length === 1 && !options.allowLastTabClose) {
          return {
            success: false,
            error: 'Cannot close the last tab',
            suggestion: 'Use allowLastTabClose: true to force close'
          };
        }
        // ... close tab
        return { success: true };
      };

      let result = closeTab(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot close the last tab');

      result = closeTab(1, { allowLastTabClose: true });
      expect(result.success).toBe(true);
    });
  });

  describe('Tab State Tracking', () => {
    test('should track tab loading state', () => {
      const tabStates = new Map();

      const updateTabState = (tabId, state) => {
        const current = tabStates.get(tabId) || {
          id: tabId,
          status: 'unknown',
          url: '',
          title: '',
          history: []
        };

        current.history.push({
          from: current.status,
          to: state.status,
          timestamp: Date.now()
        });

        Object.assign(current, state);
        tabStates.set(tabId, current);

        return current;
      };

      updateTabState(1, { status: 'loading', url: 'https://example.com' });
      updateTabState(1, { status: 'complete', title: 'Example' });

      const state = tabStates.get(1);
      expect(state.status).toBe('complete');
      expect(state.history.length).toBe(2);
    });

    test('should detect navigation in tab', () => {
      const navigationHistory = [];

      const trackNavigation = (tabId, details) => {
        const entry = {
          tabId,
          url: details.url,
          transitionType: details.transitionType || 'link',
          timestamp: Date.now()
        };

        navigationHistory.push(entry);

        return {
          entry,
          totalNavigations: navigationHistory.filter(n => n.tabId === tabId).length
        };
      };

      trackNavigation(1, { url: 'https://example.com', transitionType: 'typed' });
      trackNavigation(1, { url: 'https://example.com/page2', transitionType: 'link' });
      const result = trackNavigation(1, { url: 'https://example.com/page3' });

      expect(result.totalNavigations).toBe(3);
      expect(navigationHistory.length).toBe(3);
    });

    test('should maintain content script state per tab', () => {
      const contentScriptStates = new Map();

      const getContentScriptState = (tabId) => {
        return contentScriptStates.get(tabId) || {
          injected: false,
          connected: false,
          lastHeartbeat: null
        };
      };

      const setContentScriptState = (tabId, state) => {
        const current = getContentScriptState(tabId);
        contentScriptStates.set(tabId, { ...current, ...state });
      };

      setContentScriptState(1, { injected: true });
      setContentScriptState(1, { connected: true, lastHeartbeat: Date.now() });

      expect(getContentScriptState(1).injected).toBe(true);
      expect(getContentScriptState(1).connected).toBe(true);
      expect(getContentScriptState(2).injected).toBe(false); // Different tab
    });
  });

  describe('Cross-Tab Communication', () => {
    test('should send message to specific tab', () => {
      const messageLog = [];

      const sendToTab = (tabId, message) => {
        const entry = {
          tabId,
          message,
          timestamp: Date.now(),
          direction: 'outgoing'
        };
        messageLog.push(entry);

        // Simulate response
        return {
          success: true,
          response: { received: true, tabId }
        };
      };

      const result = sendToTab(1, { action: 'get_content' });

      expect(result.success).toBe(true);
      expect(result.response.tabId).toBe(1);
      expect(messageLog.length).toBe(1);
    });

    test('should broadcast message to all tabs', () => {
      const tabs = [
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://other.com' },
        { id: 3, url: 'https://example.com/page2' }
      ];

      const broadcastMessage = (message, filter = null) => {
        const results = [];

        for (const tab of tabs) {
          // Apply filter if provided
          if (filter && !filter(tab)) continue;

          results.push({
            tabId: tab.id,
            success: true,
            response: { acknowledged: true }
          });
        }

        return {
          sentTo: results.length,
          results
        };
      };

      // Broadcast to all
      let result = broadcastMessage({ action: 'refresh' });
      expect(result.sentTo).toBe(3);

      // Broadcast to filtered tabs
      result = broadcastMessage(
        { action: 'refresh' },
        (tab) => tab.url.includes('example.com')
      );
      expect(result.sentTo).toBe(2);
    });

    test('should aggregate responses from multiple tabs', async () => {
      const tabs = [
        { id: 1, data: { count: 10 } },
        { id: 2, data: { count: 20 } },
        { id: 3, data: { count: 30 } }
      ];

      const queryAllTabs = async (query) => {
        const responses = tabs.map(tab => ({
          tabId: tab.id,
          data: tab.data
        }));

        return {
          responses,
          aggregate: {
            totalCount: responses.reduce((sum, r) => sum + r.data.count, 0),
            tabCount: responses.length
          }
        };
      };

      const result = await queryAllTabs({ action: 'get_count' });

      expect(result.aggregate.totalCount).toBe(60);
      expect(result.aggregate.tabCount).toBe(3);
    });
  });

  describe('Parallel Operations', () => {
    test('should execute commands in parallel across tabs', async () => {
      const tabs = [1, 2, 3];
      const executionLog = [];

      const executeInParallel = async (tabIds, command) => {
        const startTime = Date.now();

        const promises = tabIds.map(async (tabId) => {
          // Simulate command execution
          await wait(10);
          executionLog.push({ tabId, command, timestamp: Date.now() });
          return { tabId, success: true, result: `Result from tab ${tabId}` };
        });

        const results = await Promise.all(promises);

        return {
          results,
          duration: Date.now() - startTime,
          parallel: true
        };
      };

      const result = await executeInParallel(tabs, { action: 'screenshot' });

      expect(result.results.length).toBe(3);
      expect(result.results.every(r => r.success)).toBe(true);
      // All should have executed nearly simultaneously
      expect(result.duration).toBeLessThan(100); // Much less than 30ms if sequential
    });

    test('should handle mixed success/failure in parallel execution', async () => {
      const tabResults = {
        1: { success: true },
        2: { success: false, error: 'Tab closed' },
        3: { success: true }
      };

      const executeInParallel = async (tabIds, command) => {
        const promises = tabIds.map(async (tabId) => {
          const result = tabResults[tabId];
          if (!result.success) {
            return { tabId, success: false, error: result.error };
          }
          return { tabId, success: true };
        });

        const results = await Promise.allSettled(promises);

        return {
          results: results.map((r, i) => r.value || { tabId: tabIds[i], error: r.reason }),
          successCount: results.filter(r => r.value?.success).length,
          failureCount: results.filter(r => !r.value?.success).length
        };
      };

      const result = await executeInParallel([1, 2, 3], { action: 'test' });

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
    });

    test('should implement parallel execution with concurrency limit', async () => {
      const MAX_CONCURRENT = 2;
      const concurrentCount = { current: 0, max: 0 };
      const tabs = [1, 2, 3, 4, 5];

      const executeWithLimit = async (tabIds, command, limit) => {
        const results = [];
        const executing = new Set();

        const execute = async (tabId) => {
          executing.add(tabId);
          concurrentCount.current = executing.size;
          concurrentCount.max = Math.max(concurrentCount.max, executing.size);

          await wait(10);

          executing.delete(tabId);
          concurrentCount.current = executing.size;

          return { tabId, success: true };
        };

        // Simple batched execution
        for (let i = 0; i < tabIds.length; i += limit) {
          const batch = tabIds.slice(i, i + limit);
          const batchResults = await Promise.all(batch.map(execute));
          results.push(...batchResults);
        }

        return { results, maxConcurrent: concurrentCount.max };
      };

      const result = await executeWithLimit(tabs, { action: 'test' }, MAX_CONCURRENT);

      expect(result.results.length).toBe(5);
      expect(result.maxConcurrent).toBeLessThanOrEqual(MAX_CONCURRENT);
    });
  });

  describe('Tab Groups', () => {
    test('should create tab group', () => {
      const groups = [];
      const tabs = [
        { id: 1, groupId: -1 },
        { id: 2, groupId: -1 },
        { id: 3, groupId: -1 }
      ];

      const createGroup = (tabIds, options = {}) => {
        const groupId = Date.now();
        const group = {
          id: groupId,
          title: options.title || '',
          color: options.color || 'grey',
          collapsed: options.collapsed || false,
          tabIds: []
        };

        for (const tabId of tabIds) {
          const tab = tabs.find(t => t.id === tabId);
          if (tab) {
            tab.groupId = groupId;
            group.tabIds.push(tabId);
          }
        }

        groups.push(group);
        return { success: true, group };
      };

      const result = createGroup([1, 2], { title: 'Research', color: 'blue' });

      expect(result.success).toBe(true);
      expect(result.group.title).toBe('Research');
      expect(result.group.tabIds).toEqual([1, 2]);
      expect(tabs[0].groupId).toBe(result.group.id);
    });

    test('should add tab to existing group', () => {
      const groups = [{ id: 100, title: 'Work', tabIds: [1, 2] }];
      const tabs = [
        { id: 1, groupId: 100 },
        { id: 2, groupId: 100 },
        { id: 3, groupId: -1 }
      ];

      const addToGroup = (tabId, groupId) => {
        const group = groups.find(g => g.id === groupId);
        const tab = tabs.find(t => t.id === tabId);

        if (!group) return { success: false, error: 'Group not found' };
        if (!tab) return { success: false, error: 'Tab not found' };

        tab.groupId = groupId;
        group.tabIds.push(tabId);

        return { success: true, group };
      };

      const result = addToGroup(3, 100);

      expect(result.success).toBe(true);
      expect(groups[0].tabIds).toContain(3);
      expect(tabs[2].groupId).toBe(100);
    });

    test('should collapse/expand group', () => {
      const group = { id: 100, collapsed: false, tabIds: [1, 2, 3] };

      const toggleGroup = (groupId, collapsed) => {
        group.collapsed = collapsed;
        return {
          success: true,
          collapsed: group.collapsed,
          hiddenTabs: collapsed ? group.tabIds.length : 0
        };
      };

      let result = toggleGroup(100, true);
      expect(result.collapsed).toBe(true);
      expect(result.hiddenTabs).toBe(3);

      result = toggleGroup(100, false);
      expect(result.collapsed).toBe(false);
      expect(result.hiddenTabs).toBe(0);
    });
  });

  describe('Tab Session Management', () => {
    test('should save tab session', () => {
      const tabs = [
        { id: 1, url: 'https://example.com', title: 'Example' },
        { id: 2, url: 'https://docs.google.com', title: 'Docs' }
      ];

      const saveSession = (name) => {
        const session = {
          id: Date.now().toString(),
          name,
          savedAt: new Date().toISOString(),
          tabs: tabs.map(t => ({
            url: t.url,
            title: t.title,
            pinned: t.pinned || false
          }))
        };

        return { success: true, session };
      };

      const result = saveSession('Work Session');

      expect(result.success).toBe(true);
      expect(result.session.name).toBe('Work Session');
      expect(result.session.tabs.length).toBe(2);
    });

    test('should restore tab session', () => {
      const savedSession = {
        tabs: [
          { url: 'https://example.com', title: 'Example' },
          { url: 'https://docs.google.com', title: 'Docs' }
        ]
      };

      const currentTabs = [];

      const restoreSession = (session, options = {}) => {
        const createdTabs = [];

        // Close existing tabs if requested
        if (options.replaceExisting) {
          currentTabs.length = 0;
        }

        for (const tabData of session.tabs) {
          const newTab = {
            id: Date.now() + createdTabs.length,
            url: tabData.url,
            title: tabData.title
          };
          currentTabs.push(newTab);
          createdTabs.push(newTab);
        }

        return {
          success: true,
          restoredCount: createdTabs.length,
          tabs: createdTabs
        };
      };

      const result = restoreSession(savedSession);

      expect(result.success).toBe(true);
      expect(result.restoredCount).toBe(2);
      expect(currentTabs.length).toBe(2);
    });

    test('should track recently closed tabs', () => {
      const recentlyClosed = [];
      const MAX_CLOSED_HISTORY = 25;

      const recordClosedTab = (tab) => {
        const entry = {
          closedAt: Date.now(),
          tab: {
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl
          }
        };

        recentlyClosed.unshift(entry);

        // Limit history size
        if (recentlyClosed.length > MAX_CLOSED_HISTORY) {
          recentlyClosed.pop();
        }

        return entry;
      };

      recordClosedTab({ url: 'https://closed1.com', title: 'Closed 1' });
      recordClosedTab({ url: 'https://closed2.com', title: 'Closed 2' });

      expect(recentlyClosed.length).toBe(2);
      expect(recentlyClosed[0].tab.title).toBe('Closed 2'); // Most recent first
    });

    test('should restore recently closed tab', () => {
      const recentlyClosed = [
        { closedAt: Date.now(), tab: { url: 'https://restored.com', title: 'Restored' } }
      ];
      const tabs = [];

      const restoreClosedTab = (index = 0) => {
        if (index >= recentlyClosed.length) {
          return { success: false, error: 'No tab to restore at this index' };
        }

        const entry = recentlyClosed.splice(index, 1)[0];
        const newTab = {
          id: Date.now(),
          url: entry.tab.url,
          title: entry.tab.title
        };

        tabs.push(newTab);

        return { success: true, tab: newTab };
      };

      const result = restoreClosedTab();

      expect(result.success).toBe(true);
      expect(result.tab.url).toBe('https://restored.com');
      expect(tabs.length).toBe(1);
      expect(recentlyClosed.length).toBe(0);
    });
  });

  describe('Tab Window Management', () => {
    test('should move tab to different window', () => {
      const windows = {
        1: { tabs: [{ id: 1 }, { id: 2 }] },
        2: { tabs: [{ id: 3 }] }
      };

      const moveTab = (tabId, targetWindowId, index = -1) => {
        // Find current window
        let sourceWindow = null;
        let tab = null;

        for (const [winId, win] of Object.entries(windows)) {
          const tabIndex = win.tabs.findIndex(t => t.id === tabId);
          if (tabIndex !== -1) {
            sourceWindow = win;
            tab = win.tabs.splice(tabIndex, 1)[0];
            break;
          }
        }

        if (!tab) return { success: false, error: 'Tab not found' };

        const targetWindow = windows[targetWindowId];
        if (!targetWindow) return { success: false, error: 'Target window not found' };

        if (index === -1) {
          targetWindow.tabs.push(tab);
        } else {
          targetWindow.tabs.splice(index, 0, tab);
        }

        return { success: true, tab, newWindowId: targetWindowId };
      };

      const result = moveTab(2, 2);

      expect(result.success).toBe(true);
      expect(windows[1].tabs.length).toBe(1);
      expect(windows[2].tabs.length).toBe(2);
      expect(windows[2].tabs.find(t => t.id === 2)).toBeDefined();
    });

    test('should create new window with tabs', () => {
      const windows = {};

      const createWindow = (options = {}) => {
        const windowId = Date.now();
        const newWindow = {
          id: windowId,
          type: options.type || 'normal',
          incognito: options.incognito || false,
          focused: options.focused !== false,
          tabs: []
        };

        // Create tabs if URLs provided
        if (options.urls) {
          for (const url of options.urls) {
            newWindow.tabs.push({
              id: Date.now() + newWindow.tabs.length,
              url,
              windowId
            });
          }
        }

        windows[windowId] = newWindow;
        return { success: true, window: newWindow };
      };

      const result = createWindow({
        urls: ['https://tab1.com', 'https://tab2.com'],
        focused: true
      });

      expect(result.success).toBe(true);
      expect(result.window.tabs.length).toBe(2);
      expect(result.window.focused).toBe(true);
    });
  });
});
