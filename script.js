document.addEventListener('DOMContentLoaded', () => {

    const appView = document.getElementById('app-view');
    const navItems = document.querySelectorAll('.nav-item');
    let modalOverlay; // To track modal instance

    // --- State ---
    let savedJobIds = JSON.parse(localStorage.getItem('savedJobs')) || [];

    // --- Filters State ---
    let filters = {
        keyword: '',
        location: '',
        mode: '',
        experience: '',
        source: '',
        sort: 'latest'
    };

    // --- Views ---

    function getDashboardHTML() {
        return `
            <div class="view-header">
                <h1 class="view-title">Dashboard</h1>
                <p class="view-subtext">60+ New opportunities matched for you today.</p>
            </div>

            <!-- Filter Bar -->
            <div class="filters-bar">
                <input type="text" id="filter-keyword" class="filter-input" placeholder="Search role or company...">
                <select id="filter-location" class="filter-select">
                    <option value="">Location</option>
                    <option value="Bangalore">Bangalore</option>
                    <option value="Pune">Pune</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Gurgaon">Gurgaon</option>
                    <option value="Remote">Remote</option>
                </select>
                <select id="filter-mode" class="filter-select">
                    <option value="">Mode</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Onsite">Onsite</option>
                </select>
                <select id="filter-experience" class="filter-select">
                    <option value="">Experience</option>
                    <option value="Fresher">Fresher</option>
                    <option value="0-1">0-1 Years</option>
                    <option value="1-3">1-3 Years</option>
                    <option value="3-5">3-5 Years</option>
                </select>
                <select id="filter-source" class="filter-select">
                    <option value="">Source</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Naukri">Naukri</option>
                    <option value="Instahyre">Instahyre</option>
                </select>
                <select id="filter-sort" class="filter-select" style="border-color: var(--text-primary);">
                    <option value="latest">Latest</option>
                    <option value="oldest">Oldest</option>
                </select>
            </div>

            <div id="job-grid-container" class="job-grid">
                <!-- Cards Injected Here -->
            </div>

            <!-- Modal Placeholder -->
            <div id="job-modal" class="modal-overlay">
                <div class="modal-content">
                    <button class="modal-close">&times;</button>
                    <div id="modal-body"></div>
                </div>
            </div>
        `;
    }

    function getSavedHTML() {
        return `
             <div class="view-header">
                <h1 class="view-title">Saved Jobs</h1>
            </div>
            <div id="saved-grid-container" class="job-grid">
                <!-- Saved Cards or Empty State -->
            </div>
             <!-- Modal Placeholder (shared) -->
            <div id="job-modal" class="modal-overlay">
                <div class="modal-content">
                    <button class="modal-close">&times;</button>
                    <div id="modal-body"></div>
                </div>
            </div>
        `;
    }

    // --- Rendering Helpers ---

    function getSourceBadgeClass(source) {
        if (source.includes('LinkedIn')) return 'badge-linkedin';
        if (source.includes('Naukri')) return 'badge-naukri';
        if (source.includes('Indeed')) return 'badge-indeed';
        return 'badge-other';
    }

    function renderCard(job) {
        const isSaved = savedJobIds.includes(job.id);
        const sourceBadge = getSourceBadgeClass(job.source);

        return `
            <div class="job-card" data-id="${job.id}">
                <div class="job-card-header">
                    <div>
                        <div class="job-title">${job.title}</div>
                        <div class="job-company">${job.company}</div>
                    </div>
                    <span class="badge-source ${sourceBadge}">${job.source}</span>
                </div>
                
                <div class="job-meta">
                    <div class="meta-item">📍 ${job.location} (${job.mode})</div>
                    <div class="meta-item">💼 ${job.experience}</div>
                    <div class="meta-item posted-ago">🕒 ${job.postedDaysAgo}d ago</div>
                </div>

                <div class="job-tags">
                    ${job.skills.slice(0, 3).map(skill => `<span class="tag">${skill}</span>`).join('')}
                    ${job.skills.length > 3 ? `<span class="tag">+${job.skills.length - 3}</span>` : ''}
                </div>

                <div class="job-salary">${job.salaryRange}</div>

                <div class="job-actions">
                    <button class="action-btn action-view" onclick="openJobModal('${job.id}')">View</button>
                    <button class="action-btn action-save ${isSaved ? 'saved' : ''}" onclick="toggleSave('${job.id}')">
                        ${isSaved ? 'Saved' : 'Save'}
                    </button>
                    <button class="action-btn action-apply" onclick="window.open('${job.applyUrl}', '_blank')">Apply</button>
                </div>
            </div>
        `;
    }

    function renderJobs(containerId, jobsList) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (jobsList.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <p>No jobs found matching your criteria.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = jobsList.map(job => renderCard(job)).join('');
    }

    function filterAndRenderDashboard() {
        let filtered = JOB_DATA.filter(job => {
            const matchKeyword = (job.title + job.company).toLowerCase().includes(filters.keyword.toLowerCase());
            const matchLoc = filters.location ? job.location.includes(filters.location) : true;
            const matchMode = filters.mode ? job.mode === filters.mode : true;
            const matchExp = filters.experience ? job.experience === filters.experience : true;
            const matchSource = filters.source ? job.source.includes(filters.source) : true;
            return matchKeyword && matchLoc && matchMode && matchExp && matchSource;
        });

        // Sort
        if (filters.sort === 'latest') {
            filtered.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
        } else {
            filtered.sort((a, b) => b.postedDaysAgo - a.postedDaysAgo);
        }

        renderJobs('job-grid-container', filtered);
    }

    function renderSavedView() {
        const savedJobs = JOB_DATA.filter(job => savedJobIds.includes(job.id));
        const container = document.getElementById('saved-grid-container');

        if (savedJobs.length === 0) {
            container.innerHTML = `
                 <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon-large">🔖</div>
                    <h3>Your bookmark list is empty.</h3>
                    <p>Jobs you save from your dashboard or digest will appear here.</p>
                    <a href="#dashboard" class="btn btn-secondary">Go to Dashboard</a>
                </div>
            `;
        } else {
            renderJobs('saved-grid-container', savedJobs);
        }
    }

    // --- Logic Exports for Inline HTML ---
    window.openJobModal = function (jobId) {
        const job = JOB_DATA.find(j => j.id === jobId);
        if (!job) return;

        const modal = document.getElementById('job-modal');
        const body = document.getElementById('modal-body');

        body.innerHTML = `
            <div class="modal-title">${job.title}</div>
            <div class="modal-subtitle">${job.company} • ${job.location} • ${job.experience}</div>
            
            <div class="modal-section-title">Description</div>
            <div class="modal-desc">${job.description}</div>

            <div class="modal-section-title">Skills Required</div>
            <div class="job-tags" style="margin-top: 8px;">
                ${job.skills.map(skill => `<span class="tag">${skill}</span>`).join('')}
            </div>

            <div class="modal-section-title">Compensation</div>
            <div style="font-weight: 600; color: var(--success-color);">${job.salaryRange}</div>
            
            <div style="margin-top: 24px; display: flex; gap: 16px;">
                <button class="btn btn-primary" style="flex: 1;" onclick="window.open('${job.applyUrl}', '_blank')">Apply Now</button>
                <button class="btn btn-secondary" style="flex: 1;" onclick="document.querySelector('.modal-close').click()">Close</button>
            </div>
        `;

        modal.classList.add('active');

        // Remove existing listener to prevent dupes if any
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.onclick = () => modal.classList.remove('active');

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) modal.classList.remove('active');
        };
    };

    window.toggleSave = function (jobId) {
        if (savedJobIds.includes(jobId)) {
            savedJobIds = savedJobIds.filter(id => id !== jobId);
        } else {
            savedJobIds.push(jobId);
        }
        localStorage.setItem('savedJobs', JSON.stringify(savedJobIds));

        // Re-render current view to update buttons
        const hash = window.location.hash.substring(1);
        if (!hash || hash === 'dashboard') {
            filterAndRenderDashboard(); // Re-render to update 'Saved' button state
        } else if (hash === 'saved') {
            renderSavedView(); // Remove from grid
        }
    };

    // --- Router ---

    function renderView() {
        let hash = window.location.hash.substring(1).toLowerCase();

        if (!hash) {
            appView.innerHTML = `
            <div class="hero-section">
                <h1 class="hero-title">Stop Missing The Right Jobs.</h1>
                <p class="hero-subtext">Precision-matched job discovery delivered daily at 9AM.</p>
                <div class="hero-actions">
                    <a href="#dashboard" class="btn btn-primary btn-lg">View Jobs</a>
                </div>
            </div>`;
            return;
        }

        updateActiveNav(hash);

        if (hash === 'dashboard') {
            appView.innerHTML = getDashboardHTML();
            filterAndRenderDashboard();
            attachFilterListeners();
        } else if (hash === 'saved') {
            appView.innerHTML = getSavedHTML();
            renderSavedView();
        } else if (hash === 'settings') {
            // Keep settings static HTML for now, or use function if dynamic
            appView.innerHTML = `
                <div class="view-header">
                    <h1 class="view-title">Settings</h1>
                    <p class="view-subtext">Refine your job matching criteria.</p>
                </div>
                <div class="card" style="width: 100%; max-width: 600px;">
                    <form onsubmit="event.preventDefault(); alert('Saved!');">
                        <div class="form-group"><label>Role</label><input class="input-field" value="Frontend Developer"></div>
                        <div class="form-group"><label>Location</label><input class="input-field" value="Bangalore"></div>
                        <button class="btn btn-primary">Save Preferences</button>
                    </form>
                </div>
             `;
        } else if (hash === 'digest') {
            appView.innerHTML = `
            <div class="view-header"><h1 class="view-title">Daily Digest</h1></div>
            <div class="empty-state">
                <div class="empty-icon-large">📨</div>
                <h3>No digest generated yet.</h3>
                <p>Your first digest will be ready after we process the job dataset.</p>
            </div>`;
        } else if (hash === 'proof') {
            appView.innerHTML = `
             <div class="view-header"><h1 class="view-title">Verification Proof</h1></div>
             <div class="card">
                <div class="proof-list">
                    <div class="proof-item"><input type="checkbox" checked disabled> <label>Route Skeleton</label></div>
                    <div class="proof-item"><input type="checkbox" checked disabled> <label>App Shell Implementation</label></div>
                    <div class="proof-item"><input type="checkbox" checked> <label>Dataset Integration (60 Jobs)</label></div>
                    <div class="proof-item"><input type="checkbox" checked> <label>Dashboard Rendering</label></div>
                    <div class="proof-item"><input type="checkbox" checked> <label>Save Functionality</label></div>
                </div>
             </div>`;
        }

        // Close mobile nav
        const mobileNav = document.querySelector('.mobile-nav');
        if (mobileNav && mobileNav.classList.contains('open')) mobileNav.classList.remove('open');
    }

    function attachFilterListeners() {
        ['keyword', 'location', 'mode', 'experience', 'source', 'sort'].forEach(key => {
            const el = document.getElementById(`filter-${key}`);
            if (el) {
                el.addEventListener('input', (e) => {
                    filters[key] = e.target.value;
                    filterAndRenderDashboard();
                });
            }
        });
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
