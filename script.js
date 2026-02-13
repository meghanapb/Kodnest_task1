document.addEventListener('DOMContentLoaded', () => {

    const appView = document.getElementById('app-view');
    const navItems = document.querySelectorAll('.nav-item');

    // --- View Templates (HTML Strings) ---

    const views = {
        'dashboard': `
            <div class="view-header">
                <h1 class="view-title">Dashboard</h1>
                <p class="view-subtext">Your daily job feed status.</p>
            </div>
            <div class="empty-state">
                <div class="empty-icon-large">📊</div>
                <h3>No jobs yet.</h3>
                <p>In the next step, you will load a realistic dataset to see matches here.</p>
                <a href="#settings" class="btn btn-primary">Configure Preferences</a>
            </div>
        `,
        'saved': `
             <div class="view-header">
                <h1 class="view-title">Saved Jobs</h1>
            </div>
            <div class="empty-state">
                <div class="empty-icon-large">🔖</div>
                <h3>Your bookmark list is empty.</h3>
                <p>Jobs you save from your dashboard or digest will appear here.</p>
                <a href="#dashboard" class="btn btn-secondary">Go to Dashboard</a>
            </div>
        `,
        'digest': `
             <div class="view-header">
                <h1 class="view-title">Daily Digest</h1>
                <p class="view-subtext">Your 9AM summary of top matches.</p>
            </div>
            <div class="empty-state">
                <div class="empty-icon-large">📨</div>
                <h3>No digest generated yet.</h3>
                <p>Your first digest will be ready after we process the job dataset.</p>
            </div>
        `,
        'settings': `
             <div class="view-header">
                <h1 class="view-title">Settings</h1>
                <p class="view-subtext">Refine your job matching criteria.</p>
            </div>
            
            <div class="card settings-card">
                <h2 class="card-title">Job Preferences</h2>
                <form class="settings-form" onsubmit="event.preventDefault();">
                    <div class="form-group">
                        <label for="role">Role Keywords</label>
                        <input type="text" id="role" class="input-field" placeholder="e.g. Frontend Developer, React, Product Manager">
                    </div>
                    
                    <div class="form-group">
                        <label for="location">Preferred Locations</label>
                        <input type="text" id="location" class="input-field" placeholder="e.g. Remote, San Francisco, London">
                    </div>
                
                    <div class="form-group">
                        <label>Work Mode</label>
                        <div class="radio-pill-group">
                            <label class="radio-pill">
                                <input type="radio" name="mode" value="remote">
                                <span>Remote</span>
                            </label>
                            <label class="radio-pill">
                                <input type="radio" name="mode" value="hybrid">
                                <span>Hybrid</span>
                            </label>
                            <label class="radio-pill">
                                <input type="radio" name="mode" value="onsite">
                                <span>Onsite</span>
                            </label>
                             <label class="radio-pill">
                                <input type="radio" name="mode" value="any" checked>
                                <span>Any</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="experience">Experience Level</label>
                         <select id="experience" class="input-field">
                            <option value="intern">Internship</option>
                            <option value="entry">Entry Level (0-2 years)</option>
                            <option value="mid" selected>Mid Level (2-5 years)</option>
                            <option value="senior">Senior Level (5+ years)</option>
                            <option value="lead">Lead / Manager</option>
                        </select>
                    </div>

                    <div class="actions">
                        <button class="btn btn-primary" onclick="alert('Preferences saved (Simulator).')">Save Preferences</button>
                    </div>
                </form>
            </div>
        `,
        'proof': `
             <div class="view-header">
                <h1 class="view-title">Verification Proof</h1>
                <p class="view-subtext">Use this checklist to verify your build progress.</p>
            </div>
            <div class="card">
                <div class="proof-list">
                    <div class="proof-item"><input type="checkbox" checked disabled> <label>Route Skeleton</label></div>
                    <div class="proof-item"><input type="checkbox" checked disabled> <label>App Shell Implementation</label></div>
                    <div class="proof-item"><input type="checkbox"> <label>Dataset Integration (Pending)</label></div>
                    <div class="proof-item"><input type="checkbox"> <label>Matching Logic (Pending)</label></div>
                </div>
            </div>
        `,
        'home': `
            <div class="hero-section">
                <h1 class="hero-title">Stop Missing The Right Jobs.</h1>
                <p class="hero-subtext">Precision-matched job discovery delivered daily at 9AM.</p>
                <div class="hero-actions">
                    <a href="#settings" class="btn btn-primary btn-lg">Start Tracking</a>
                </div>
            </div>
        `
    };

    function renderView() {
        let hash = window.location.hash.substring(1).toLowerCase();

        // Handle root path or empty hash -> Home
        if (!hash) {
            appView.innerHTML = views['home'];
            updateActiveNav('home'); // No nav link is active for Home usually, or maybe Dashboard? User didn't specify.
            // Let's clear active state for home
            navItems.forEach(item => item.classList.remove('active'));
            return;
        }

        if (views[hash]) {
            appView.innerHTML = views[hash];
            updateActiveNav(hash);
        } else {
            // Fallback to home or 404
            appView.innerHTML = views['home'];
        }

        // Close mobile menu
        const mobileNav = document.querySelector('.mobile-nav');
        if (mobileNav.classList.contains('open')) {
            mobileNav.classList.remove('open');
        }
    }

    function updateActiveNav(hash) {
        navItems.forEach(item => {
            if (item.getAttribute('href') === `#${hash}`) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Initialize
    window.addEventListener('hashchange', renderView);
    renderView(); // Initial

    // Mobile Menu
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const mobileNav = document.querySelector('.mobile-nav');
    if (menuBtn && mobileNav) {
        menuBtn.addEventListener('click', () => {
            mobileNav.classList.toggle('open');
        });
    }
});
