document.addEventListener('DOMContentLoaded', () => {

    const appView = document.getElementById('app-view');
    const navItems = document.querySelectorAll('.nav-item');
    let modalOverlay;

    // --- State ---
    let savedJobIds = JSON.parse(localStorage.getItem('savedJobs')) || [];
    let preferences = JSON.parse(localStorage.getItem('jobTrackerPreferences')) || {
        roleKeywords: '',
        preferredLocations: '',
        preferredMode: ['any'],
        experienceLevel: '',
        skills: '',
        minMatchScore: 40
    };

    // --- Filters State ---
    let filters = {
        keyword: '',
        location: '',
        mode: '',
        experience: '',
        source: '',
        sort: 'latest',
        showOnlyMatches: false
    };

    // --- Match Score Engine ---
    function calculateMatchScore(job) {
        if (!preferences.roleKeywords && !preferences.skills) return 0; // No prefs set

        let score = 0;
        const roleKeywords = preferences.roleKeywords.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
        const userSkills = preferences.skills.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
        const prefLocs = preferences.preferredLocations.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

        // 1. Role Keyword in Title (+25)
        const titleLower = job.title.toLowerCase();
        if (roleKeywords.some(kw => titleLower.includes(kw))) {
            score += 25;
        }

        // 2. Role Keyword in Description (+15)
        const descLower = job.description.toLowerCase();
        if (roleKeywords.some(kw => descLower.includes(kw))) {
            score += 15;
        }

        // 3. Location Match (+15)
        if (prefLocs.some(loc => job.location.toLowerCase().includes(loc))) {
            score += 15;
        }

        // 4. Mode Match (+10)
        // Check if job mode matches ANY of the preferred modes.
        // If 'any' is selected alongside others, strict logic usually applies to specific choices, but if 'any' is checked it usually means wildcard.
        // Let's assume strict set match: if preferredMode includes 'any', or exactly matches job.mode
        const pModes = preferences.preferredMode.map(m => m.toLowerCase());
        if (pModes.includes('any') || pModes.includes(job.mode.toLowerCase())) {
            score += 10;
        }

        // 5. Experience Match (+10)
        // Simple string match for MVP
        if (preferences.experienceLevel && job.experience.toLowerCase().includes(preferences.experienceLevel.toLowerCase())) {
            score += 10;
        }

        // 6. Skill Overlap (+15 if any match)
        const jobSkillsLower = job.skills.map(s => s.toLowerCase());
        const hasSkillMatch = userSkills.some(us =>
            jobSkillsLower.some(js => js.includes(us) || us.includes(js))
        );
        if (hasSkillMatch) {
            score += 15;
        }

        // 7. Posted Days Ago <= 2 (+5)
        if (job.postedDaysAgo <= 2) {
            score += 5;
        }

        // 8. Source is LinkedIn (+5)
        if (job.source.includes('LinkedIn')) {
            score += 5;
        }

        return Math.min(score, 100);
    }

    function getMatchBadgeHTML(score) {
        if (score < 1) return '';
        let className = 'subtle';
        if (score >= 80) className = 'high';
        else if (score >= 60) className = 'med';
        else if (score >= 40) className = 'neutral';

        return `<div class="match-score ${className}">⚡ ${score}% Match</div>`;
    }

    // --- Views ---

    function getDashboardHTML() {
        return `
            <div class="view-header">
                <h1 class="view-title">Dashboard</h1>
                <p class="view-subtext">60+ New opportunities matched for you today.</p>
                <div style="margin-top: 16px; display: flex; align-items: center; gap: 12px;">
                    <label class="toggle-container">
                        <div class="toggle-switch">
                            <input type="checkbox" id="toggle-matches" ${filters.showOnlyMatches ? 'checked' : ''}>
                            <span class="slider"></span>
                        </div>
                        Show only jobs above my threshold (${preferences.minMatchScore}%)
                    </label>
                </div>
            </div>

            <!-- Filter Bar -->
            <div class="filters-bar">
                <input type="text" id="filter-keyword" class="filter-input" value="${filters.keyword}" placeholder="Search role or company...">
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
                    <option value="match" selected>Match Score</option>
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

    function getSettingsHTML() {
        const p = preferences;
        const isRemote = p.preferredMode.includes('remote');
        const isHybrid = p.preferredMode.includes('hybrid');
        const isOnsite = p.preferredMode.includes('onsite');
        const isAny = p.preferredMode.includes('any');

        return `
            <div class="view-header">
                <h1 class="view-title">Settings</h1>
                <p class="view-subtext">Refine your job matching criteria.</p>
            </div>
            
            <div class="card settings-card">
                <h2 class="card-title">Job Preferences</h2>
                <form class="settings-form" id="settings-form">
                    <div class="form-group">
                        <label for="pref-role">Role Keywords (comma separated)</label>
                        <input type="text" id="pref-role" class="input-field" value="${p.roleKeywords}" placeholder="e.g. Frontend Developer, React, Product Manager">
                    </div>
                    
                    <div class="form-group">
                        <label for="pref-skills">Skills (comma separated)</label>
                        <input type="text" id="pref-skills" class="input-field" value="${p.skills}" placeholder="e.g. Java, Python, AWS, Figma">
                    </div>

                    <div class="form-group">
                        <label for="pref-loc">Preferred Locations (comma separated)</label>
                        <input type="text" id="pref-loc" class="input-field" value="${p.preferredLocations}" placeholder="e.g. Remote, Bangalore, London">
                    </div>
                
                    <div class="form-group">
                        <label>Work Mode</label>
                        <div class="radio-pill-group">
                            <label class="radio-pill">
                                <input type="checkbox" name="pref-mode" value="remote" ${isRemote ? 'checked' : ''}>
                                <span>Remote</span>
                            </label>
                            <label class="radio-pill">
                                <input type="checkbox" name="pref-mode" value="hybrid" ${isHybrid ? 'checked' : ''}>
                                <span>Hybrid</span>
                            </label>
                            <label class="radio-pill">
                                <input type="checkbox" name="pref-mode" value="onsite" ${isOnsite ? 'checked' : ''}>
                                <span>Onsite</span>
                            </label>
                             <label class="radio-pill">
                                <input type="checkbox" name="pref-mode" value="any" ${isAny ? 'checked' : ''}>
                                <span>Any</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="pref-exp">Experience Level</label>
                         <select id="pref-exp" class="input-field">
                            <option value="">Select Level</option>
                            <option value="intern" ${p.experienceLevel === 'intern' ? 'selected' : ''}>Internship</option>
                            <option value="entry" ${p.experienceLevel === 'entry' ? 'selected' : ''}>Entry Level (0-2 years)</option>
                            <option value="1-3" ${p.experienceLevel === '1-3' ? 'selected' : ''}>Mid Level (1-3 years)</option>
                            <option value="3-5" ${p.experienceLevel === '3-5' ? 'selected' : ''}>Mid-Senior (3-5 years)</option>
                            <option value="senior" ${p.experienceLevel === 'senior' ? 'selected' : ''}>Senior Level (5+ years)</option>
                            <option value="lead" ${p.experienceLevel === 'lead' ? 'selected' : ''}>Lead / Manager</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="pref-threshold">Minimum Match Score Threshold: <span id="threshold-val">${p.minMatchScore}</span>%</label>
                        <input type="range" id="pref-threshold" min="0" max="100" value="${p.minMatchScore}" oninput="document.getElementById('threshold-val').textContent = this.value">
                    </div>

                    <div class="actions">
                        <button type="submit" class="btn btn-primary">Save Preferences</button>
                    </div>
                </form>
            </div>
        `;
    }

    // --- Rendering Logic ---

    function renderCard(job, score) {
        const isSaved = savedJobIds.includes(job.id);
        const sourceBadge = getSourceBadgeClass(job.source); // Helper assumed from previous or reused
        const matchBadge = getMatchBadgeHTML(score);

        return `
            <div class="job-card" data-id="${job.id}">
                ${matchBadge}
                <div class="job-card-header" style="margin-top: ${score > 0 ? '20px' : '0'};">
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

    function filterAndRenderDashboard() {
        const container = document.getElementById('job-grid-container');
        if (!container) return; // Not on dashboard

        // 1. Calculate Scores & Filter
        let processed = JOB_DATA.map(job => {
            return { ...job, score: calculateMatchScore(job) };
        });

        let filtered = processed.filter(job => {
            const matchKeyword = (job.title + job.company).toLowerCase().includes(filters.keyword.toLowerCase());
            const matchLoc = filters.location ? job.location.includes(filters.location) : true;
            const matchMode = filters.mode ? job.mode === filters.mode : true;
            const matchExp = filters.experience ? job.experience === filters.experience : true;
            const matchSource = filters.source ? job.source.includes(filters.source) : true;

            // NEW: Threshold Filter
            const matchThreshold = filters.showOnlyMatches ? job.score >= preferences.minMatchScore : true;

            return matchKeyword && matchLoc && matchMode && matchExp && matchSource && matchThreshold;
        });

        // 2. Sort
        if (filters.sort === 'latest') {
            filtered.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
        } else if (filters.sort === 'match') {
            filtered.sort((a, b) => b.score - a.score);
        } else if (filters.sort === 'oldest') {
            filtered.sort((a, b) => b.postedDaysAgo - a.postedDaysAgo);
        }

        // 3. Render
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-icon-large">🔍</div>
                    <h3>No matches found.</h3>
                    <p>Try adjusting your filters or lowering your match threshold (Current: ${preferences.minMatchScore}%).</p>
                </div>
            `;
            return;
        }

        // If no prefs set
        const prefsSet = preferences.roleKeywords || preferences.skills;
        const banner = !prefsSet ? `
            <div class="empty-state" style="grid-column: 1 / -1; background-color: #E3F2FD; margin-bottom: 24px;">
                <p style="margin:0; color: #0D47A1;"><strong>Tip:</strong> Set your preferences in Settings to activate intelligent matching.</p>
            </div>
        ` : '';

        container.innerHTML = banner + filtered.map(job => renderCard(job, job.score)).join('');
    }

    // --- Actions ---

    window.saveSettings = function (e) {
        e.preventDefault();
        const fd = new FormData(e.target); // Doesn't work well with custom standard logic sometimes, manual pull better

        const modes = Array.from(document.querySelectorAll('input[name="pref-mode"]:checked')).map(el => el.value);

        preferences = {
            roleKeywords: document.getElementById('pref-role').value,
            preferredLocations: document.getElementById('pref-loc').value,
            skills: document.getElementById('pref-skills').value,
            experienceLevel: document.getElementById('pref-exp').value,
            minMatchScore: parseInt(document.getElementById('pref-threshold').value),
            preferredMode: modes
        };

        localStorage.setItem('jobTrackerPreferences', JSON.stringify(preferences));
        alert('Preferences Saved! Dashboard scores updated.');
        window.location.hash = '#dashboard';
    };

    // --- Helpers Reuse ---
    function getSourceBadgeClass(source) {
        if (source.includes('LinkedIn')) return 'badge-linkedin';
        if (source.includes('Naukri')) return 'badge-naukri';
        if (source.includes('Indeed')) return 'badge-indeed';
        return 'badge-other';
    }

    // --- Router & Init ---
    // (Reusing existing render logic with updates for Settings and Dashboard)

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
            attachDashboardListeners();
        } else if (hash === 'saved') {
            // Basic Saved View (Reused)
            appView.innerHTML = `
             <div class="view-header"><h1 class="view-title">Saved Jobs</h1></div>
             <div id="saved-grid-container" class="job-grid"></div>
             <div id="job-modal" class="modal-overlay"><div class="modal-content"><button class="modal-close">&times;</button><div id="modal-body"></div></div></div>`;

            // Render saved
            const saved = JOB_DATA.filter(j => savedJobIds.includes(j.id));
            if (saved.length === 0) {
                document.getElementById('saved-grid-container').innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><h3>No saved jobs.</h3></div>`;
            } else {
                document.getElementById('saved-grid-container').innerHTML = saved.map(j => renderCard(j, calculateMatchScore(j))).join('');
            }

        } else if (hash === 'settings') {
            appView.innerHTML = getSettingsHTML();
            document.getElementById('settings-form').addEventListener('submit', window.saveSettings);
        } else if (hash === 'proof') {
            appView.innerHTML = `
             <div class="view-header"><h1 class="view-title">Verification Proof</h1></div>
             <div class="card"><div class="proof-list">
                <div class="proof-item"><input type="checkbox" checked disabled><label>Data Upgrade</label></div>
                <div class="proof-item"><input type="checkbox" checked><label>Preference Logic & Persistence</label></div>
                <div class="proof-item"><input type="checkbox" checked><label>Match Score Engine</label></div>
             </div></div>`;
        }

        // Close mobile nav
        const mobileNav = document.querySelector('.mobile-nav');
        if (mobileNav && mobileNav.classList.contains('open')) mobileNav.classList.remove('open');
    }

    function attachDashboardListeners() {
        ['keyword', 'location', 'mode', 'experience', 'source', 'sort'].forEach(key => {
            const el = document.getElementById(`filter-${key}`);
            if (el) {
                el.addEventListener('input', (e) => {
                    filters[key] = e.target.value;
                    filterAndRenderDashboard();
                });
            }
        });

        const toggle = document.getElementById('toggle-matches');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                filters.showOnlyMatches = e.target.checked;
                filterAndRenderDashboard();
            });
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

    // Export Helpers needed for inline HTML onclicks 
    window.openJobModal = function (jobId) {
        const job = JOB_DATA.find(j => j.id === jobId);
        if (!job) return;
        const modal = document.getElementById('job-modal');
        const body = document.getElementById('modal-body');

        // (Same modal content logic as before)
        body.innerHTML = `
            <div class="modal-title">${job.title}</div>
            <div class="modal-subtitle">${job.company} • ${job.location}</div>
            <div class="modal-desc">${job.description}</div>
            <div style="margin-top:20px; font-weight:bold;">Match Score: ${calculateMatchScore(job)}%</div>
            <div style="margin-top: 24px;">
                <button class="btn btn-secondary" onclick="document.querySelector('.modal-close').click()">Close</button>
            </div>
        `;
        modal.classList.add('active');
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.onclick = () => modal.classList.remove('active');
        modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    };

    window.toggleSave = function (jobId) {
        if (savedJobIds.includes(jobId)) savedJobIds = savedJobIds.filter(id => id !== jobId);
        else savedJobIds.push(jobId);
        localStorage.setItem('savedJobs', JSON.stringify(savedJobIds));

        // Re-render
        if (window.location.hash === '#dashboard') filterAndRenderDashboard();
        else if (window.location.hash === '#saved') renderView();
    };

    window.addEventListener('hashchange', renderView);
    renderView(); // Initial rendering
});
