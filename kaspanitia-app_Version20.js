function setCurrentUser(userId) {
  if (!state.users.some(u => u.id === userId)) return;
  state.currentUserId = userId;
  localStorage.setItem(AUTH_KEY, JSON.stringify({ userId }));
  saveState();
  render();
}
