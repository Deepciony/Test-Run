import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Inspect from 'vite-plugin-inspect'

export default defineConfig({
    plugins: [sveltekit(), Inspect()],
    server: {
        // 👇 เปลี่ยนเป็น 3000 (พอร์ตนี้มักจะไม่โดนบล็อกครับ)
        port: 3000, 
        
        
       
    }
    
});