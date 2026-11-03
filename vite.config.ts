import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
plugins: [react()],
base: '/myownweb/',
server: {
port: 2244,
open: true,
},
})
