export const useDashboard = () => {
  const isSidebarOpen = useState('dashboard-sidebar-open', () => true)

  return {
    isSidebarOpen,
    toggleSidebar: () => { isSidebarOpen.value = !isSidebarOpen.value }
  }
}
