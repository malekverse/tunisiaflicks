// Configuration for dynamic routes
export const dynamicRoutes = {
  '/auth/reset-password': {
    dynamic: 'force-dynamic',
    revalidate: false
  },
  '/tunisian/episodes': {
    dynamic: 'force-dynamic',
    revalidate: false
  }
};