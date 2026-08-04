import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#11131a',
        paper: '#f5f3ee',
        ember: '#f05a35',
        plum: '#6d3df5',
      },
      boxShadow: {
        float: '0 24px 80px -30px rgba(24, 20, 40, .35)',
      },
    },
  },
  plugins: [],
}

export default config
