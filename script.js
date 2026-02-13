document.addEventListener('DOMContentLoaded', () => {

    // --- Router Logic ---
    const appView = document.getElementById('app-view');
    const navItems = document.querySelectorAll('.nav-item');

    // Define routes and their content
    const routes = {
        'dashboard': {
            title: 'Dashboard',
            subtext: 'This section will be built in the next step. It will contain an overview of your job notifications.'
        },
        'saved': {
            title: 'Saved Jobs',
            subtext: 'This section will be built in the next step. It will list your saved opportunities.'
        },
        'digest': {
            title: 'Daily Digest',
            subtext: 'This section will be built in the next step. It will show your summarized updates.'
        },
        'settings': {
            title: 'Settings',
            subtext: 'This section will be built in the next step. Configure your notification preferences here.'
        },
        'proof': {
            title: 'Verification Proof',
            subtext: 'This section will be built in the next step. Use this to verify your implementation.'
        }
    };

    function renderView() {
        // Get hash (remove #), default to 'dashboard' if empty or invalid
        let hash = window.location.hash.substring(1).toLowerCase();
        if (!hash || !routes[hash]) {
            hash = 'dashboard';
        }

        const routeData = routes[hash];

        // 1. Update View Content
        appView.innerHTML = `
            <div class="view-header">
                <h1 class="view-title">${routeData.title}</h1>
                <p class="view-subtext">${routeData.subtext}</p>
            </div>
        `;

        // 2. Update Active Link State
        navItems.forEach(item => {
            if (item.getAttribute('href') === `#${hash}`) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // 3. Close mobile menu if open
        const mobileNav = document.querySelector('.mobile-nav');
        if (mobileNav.classList.contains('open')) {
            mobileNav.classList.remove('open');
        }
    }

    // Initialize router
    window.addEventListener('hashchange', renderView);
    renderView(); // Initial render

    // --- Mobile Menu Logic ---
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const mobileNav = document.querySelector('.mobile-nav');

    if (menuBtn && mobileNav) {
        menuBtn.addEventListener('click', () => {
            mobileNav.classList.toggle('open');
        });
    }
});
