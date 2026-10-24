function persistAuthSession() {
  if (!state.currentUserId || !state.users.some(u => u.id === state.currentUserId)) {
    state.currentUserId = defaultState.currentUserId;
  }
  localStorage.setItem(AUTH_KEY, JSON.stringify({ userId: state.currentUserId }));
}

function setLoggedUser(userId) {
  if (!state.users.some(u => u.id === userId)) return;
  state.currentUserId = userId;
  persistAuthSession();
  saveState();
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  state.currentUserId = defaultState.currentUserId;
  activeScreen = "dashboard";
  saveState();
  showAuth();
}

function setCurrentUser(userId) {
  if (!state.users.some(u => u.id === userId)) return;
  state.currentUserId = userId;
  persistAuthSession();
  saveState();
  render();
}
