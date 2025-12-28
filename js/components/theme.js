// js/components/theme.js - Dark mode toggle component

import { APP_CONFIG } from '../config.js';

class ThemeManager {
    constructor() {
        this.isDarkMode = true;
    }

    init() {
        // Default to dark mode if no preference is saved
        const savedPref = localStorage.getItem('darkMode');
        this.isDarkMode = savedPref !== 'false';
        
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
        }
        
        this.updateButton();
    }

    toggle() {
        document.body.classList.toggle('dark-mode');
        this.isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', this.isDarkMode);
        this.updateButton();
    }

    updateButton() {
        const btn = document.querySelector('.dark-mode-toggle');
        if (btn) {
            btn.textContent = this.isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
        }
    }
}

const theme = new ThemeManager();

export default theme;
