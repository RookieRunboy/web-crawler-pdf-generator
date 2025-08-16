// 统一的样式系统 - 提取常用的Tailwind类组合

// 页面布局样式
export const pageStyles = {
  // 页面容器
  container: 'min-h-screen p-4',
  containerBlue: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4',
  containerPurple: 'min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4',
  
  // 内容区域
  content: 'max-w-4xl mx-auto',
  contentWide: 'max-w-6xl mx-auto',
  
  // 卡片容器
  card: 'bg-white rounded-xl shadow-lg p-6',
  cardSmall: 'bg-white rounded-lg p-6 shadow-md',
};

// 文本样式
export const textStyles = {
  // 标题
  title: 'text-3xl font-bold text-gray-800',
  titleLarge: 'text-4xl font-bold text-gray-800',
  subtitle: 'text-2xl font-semibold text-gray-800',
  sectionTitle: 'text-xl font-semibold text-gray-800',
  
  // 正文
  body: 'text-gray-600',
  bodyLarge: 'text-gray-600 text-lg',
  bodySmall: 'text-sm text-gray-600',
  
  // 标签
  label: 'block text-sm font-medium text-gray-700',
  description: 'text-sm text-gray-500',
  
  // 状态文本
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-orange-600 font-medium',
  info: 'text-blue-600',
};

// 按钮样式
export const buttonStyles = {
  // 主要按钮
  primary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors',
  primaryLarge: 'bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors',
  
  // 次要按钮
  secondary: 'bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors',
  
  // 成功按钮
  success: 'bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors',
  
  // 危险按钮
  danger: 'bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors',
  
  // 紫色主题按钮
  purple: 'bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors',
  
  // 图标按钮
  icon: 'p-2 text-gray-600 hover:text-gray-800 transition-colors',
  iconColored: 'p-2 transition-colors',
};

// 表单样式
export const formStyles = {
  // 输入框
  input: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  inputDisabled: 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed',
  
  // 选择框
  select: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white',
  
  // 文本域
  textarea: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  
  // 复选框
  checkbox: 'w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500',
};

// 状态指示器样式
export const statusStyles = {
  // 状态图标
  pending: 'w-5 h-5 text-yellow-500',
  loading: 'w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin',
  success: 'w-5 h-5 text-green-500',
  error: 'w-5 h-5 text-red-500',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
  
  // 状态背景
  successBg: 'bg-green-50 border border-green-200 rounded p-3',
  errorBg: 'bg-red-50 border border-red-200 rounded p-3',
  infoBg: 'bg-blue-50 border border-blue-200 rounded p-3',
  warningBg: 'bg-yellow-50 border border-yellow-200 rounded p-3',
};

// 布局样式
export const layoutStyles = {
  flexBetween: 'flex items-center justify-between',
  flexCenter: 'flex items-center justify-center',
  flexStart: 'flex items-center justify-start',
  spaceY4: 'space-y-4',
  spaceY6: 'space-y-6',
  grid2: 'grid grid-cols-1 md:grid-cols-2 gap-6',
  grid3: 'grid grid-cols-1 md:grid-cols-3 gap-6',
};

// 动画样式
export const animationStyles = {
  // 过渡动画
  transition: 'transition-colors',
  transitionAll: 'transition-all duration-300',
  
  // 悬停效果
  hover: 'hover:shadow-md transition-shadow',
  hoverScale: 'hover:scale-105 transition-transform',
};

// 图标样式
export const iconStyles = {
  small: 'w-4 h-4',
  medium: 'w-5 h-5',
  large: 'w-6 h-6',
  xlarge: 'w-8 h-8',
  xxlarge: 'w-12 h-12',
  
  // 带颜色的图标
  blue: 'text-blue-600',
  green: 'text-green-600',
  red: 'text-red-600',
  purple: 'text-purple-600',
  gray: 'text-gray-600',
};

// 组合样式函数
export const combineStyles = (...styles: string[]) => styles.join(' ');

// 条件样式函数
export const conditionalStyle = (condition: boolean, trueStyle: string, falseStyle: string = '') => 
  condition ? trueStyle : falseStyle;