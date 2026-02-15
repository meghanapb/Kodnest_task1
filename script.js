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

        const titleLower = job.title.toLowerCase();
        if (roleKeywords.some(kw => titleLower.includes(kw))) score += 25;

        const descLower = job.description.toLowerCase();
        if (roleKeywords.some(kw => descLower.includes(kw))) score += 15;

        if (prefLocs.some(loc => job.location.toLowerCase().includes(loc))) score += 15;

        const pModes = preferences.preferredMode.map(m => m.toLowerCase());
        if (pModes.includes('any') || pModes.includes(job.mode.toLowerCase())) score += 10;

        if (preferences.experienceLevel && job.experience.toLowerCase().includes(preferences.experienceLevel.toLowerCase())) score += 10;

        const jobSkillsLower = job.skills.map(s => s.toLowerCase());
        const hasSkillMatch = userSkills.some(us =>
            jobSkillsLower.some(js => js.includes(us) || us.includes(js))
        );
        if (hasSkillMatch) score += 15;

        if (job.postedDaysAgo <= 2) score += 5;
        if (job.source.includes('LinkedIn')) score += 5;

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

    // --- Digest Engine ---

    function getTodayDigestKey() {
        const today = new Date().toISOString().split('T')[0];
        return `jobTrackerDigest_${today}`;
    }

    function generateDigest() {
        // Recalculate all scores
        const scoredJobs = JOB_DATA.map(j => ({ ...j, score: calculateMatchScore(j) }));

        // Filter by min threshold
        const viableJobs = scoredJobs.filter(j => j.score >= preferences.minMatchScore);

        if (viableJobs.length === 0) return null;

        // Sort: Score Desc, then Date Asc (freshness)
        viableJobs.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.postedDaysAgo - b.postedDaysAgo;
        });

        // Top 10
        const digest = viableJobs.slice(0, 10);

        localStorage.setItem(getTodayDigestKey(), JSON.stringify(digest));
        return digest;
    }

    function renderDigestView() {
        if (!preferences.roleKeywords && !preferences.skills) {
            appView.innerHTML = `
                <div class="view-header"><h1 class="view-title">Daily Digest</h1></div>
                <div class="empty-state">
                    <div class="empty-icon-large">⚙️</div>
                    <h3>Setup Required</h3>
                    <p>Set your preferences to generate a personalized daily digest.</p>
                    <a href="#settings" class="btn btn-primary">Go to Settings</a>
                </div>`;
            return;
        }

        const digestKey = getTodayDigestKey();
        let digest = JSON.parse(localStorage.getItem(digestKey));

        if (!digest) {
            // Show Generate Button
            appView.innerHTML = `
                <div class="view-header"><h1 class="view-title">Daily Digest</h1></div>
                <div class="empty-state">
                    <div class="empty-icon-large">📨</div>
                    <h3>Your 9AM Digest is ready.</h3>
                    <p>Generate your personalized list of top opportunities for today.</p>
                    <button class="btn btn-primary btn-lg" onclick="triggerDigestGeneration()">Generate Today's 9AM Digest (Simulated)</button>
                    <p style="margin-top:20px; font-size:12px; color:#999;">Demo Mode: Daily 9AM trigger simulated manually.</p>
                </div>`;
        } else {
            // Render Digest
            const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            const listHTML = digest.map(job => `
                <div class="digest-item">
                    <div>
                        <div style="font-weight:700; color:#111;">${job.title}</div>
                        <div style="font-size:13px; color:#555;">${job.company} • ${job.location}</div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-weight:700; color:${getScoreColor(job.score)};">${job.score}% Match</span>
                         <br><a href="${job.applyUrl}" target="_blank" style="font-size:12px; color:var(--accent-color); text-decoration:underline;">Apply</a>
                    </div>
                </div>
            `).join('');

            appView.innerHTML = `
                <div class="view-header" style="text-align:center;"><h1 class="view-title">Daily Digest</h1></div>
                
                <div class="digest-container">
                    <div class="digest-header">
                        <div class="digest-title">Top 10 Jobs For You</div>
                        <div class="digest-date">${todayStr}</div>
                    </div>
                    <div class="digest-body">
                        ${listHTML}
                    </div>
                    <div class="digest-footer">
                        This digest was generated based on your preferences.<br>
                        <a href="#settings" style="text-decoration:underline;">Update Preferences</a>
                    </div>
                </div>

                <div class="digest-actions">
                     <button class="btn btn-secondary" onclick="copyDigestText()">Copy to Clipboard</button>
                     <button class="btn btn-secondary" onclick="sendDigestEmail()">Create Email Draft</button>
                </div>
            `;
        }
    }

    // Helper helper
    function getScoreColor(score) {
        if (score >= 80) return '#2E7D32';
        if (score >= 60) return '#F57F17';
        if (score >= 40) return '#546E7A';
        return '#9E9E9E';
    }

    window.triggerDigestGeneration = function () {
        const result = generateDigest();
        if (!result) {
            alert('No matching roles found today based on your preferences.');
        } else {
            renderDigestView();
        }
    };

    window.copyDigestText = function () {
        const digestKey = getTodayDigestKey();
        const digest = JSON.parse(localStorage.getItem(digestKey));
        if (!digest) return;

        let text = `My 9AM Job Digest - ${new Date().toLocaleDateString()}\n\n`;
        digest.forEach(j => {
            text += `${j.title} at ${j.company} (${j.score}% Match)\n${j.location} | ${j.salaryRange}\nApply: ${j.applyUrl}\n\n`;
        });

        navigator.clipboard.writeText(text).then(() => alert('Digest copied to clipboard!'));
    };

    window.sendDigestEmail = function () {
        const digestKey = getTodayDigestKey();
        const digest = JSON.parse(localStorage.getItem(digestKey));
        if (!digest) return;

        let body = `Here are my top job matches for today:\n\n`;
        digest.forEach(j => {
            body += `${j.title} at ${j.company} (${j.score}% Match)\n${j.location}\n${j.applyUrl}\n\n`;
        });

        window.open(`mailto:?subject=My 9AM Job Digest&body=${encodeURIComponent(body)}`);
    };


    // --- View Logic (Reused) ---

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
                </select>
                <select id="filter-sort" class="filter-select" style="border-color: var(--text-primary);">
                    <option value="latest">Latest</option>
                    <option value="match" selected>Match Score</option>
                    <option value="oldest">Oldest</option>
                </select>
            </div>

            <div id="job-grid-container" class="job-grid"></div>
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
                        <input type="text" id="pref-role" class="input-field" value="${p.roleKeywords}" placeholder="e.g. Frontend Developer, React">
                    </div>
                    <div class="form-group">
                        <label for="pref-skills">Skills (comma separated)</label>
                        <input type="text" id="pref-skills" class="input-field" value="${p.skills}" placeholder="e.g. Java, Python">
                    </div>
                    <div class="form-group">
                         <label for="pref-loc">Preferred Locations (comma separated)</label>
                         <input type="text" id="pref-loc" class="input-field" value="${p.preferredLocations}" placeholder="e.g. Remote, Bangalore">
                    </div>
                    <div class="form-group">
                        <label>Work Mode</label>
                        <div class="radio-pill-group">
                            <label class="radio-pill"><input type="checkbox" name="pref-mode" value="remote" ${isRemote ? 'checked' : ''}><span>Remote</span></label>
                            <label class="radio-pill"><input type="checkbox" name="pref-mode" value="hybrid" ${isHybrid ? 'checked' : ''}><span>Hybrid</span></label>
                            <label class="radio-pill"><input type="checkbox" name="pref-mode" value="onsite" ${isOnsite ? 'checked' : ''}><span>Onsite</span></label>
                            <label class="radio-pill"><input type="checkbox" name="pref-mode" value="any" ${isAny ? 'checked' : ''}><span>Any</span></label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="pref-exp">Experience Level</label>
                         <select id="pref-exp" class="input-field">
                            <option value="">Select Level</option>
                            <option value="intern" ${p.experienceLevel === 'intern' ? 'selected' : ''}>Internship</option>
                            <option value="entry" ${p.experienceLevel === 'entry' ? 'selected' : ''}>0-2 Years</option>
                            <option value="1-3" ${p.experienceLevel === '1-3' ? 'selected' : ''}>1-3 Years</option>
                            <option value="3-5" ${p.experienceLevel === '3-5' ? 'selected' : ''}>3-5 Years</option>
                            <option value="senior" ${p.experienceLevel === 'senior' ? 'selected' : ''}>5+ Years</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="pref-threshold">Threshold: <span id="threshold-val">${p.minMatchScore}</span>%</label>
                        <input type="range" id="pref-threshold" min="0" max="100" value="${p.minMatchScore}" oninput="document.getElementById('threshold-val').textContent = this.value">
                    </div>
                    <div class="actions">
                        <button type="submit" class="btn btn-primary">Save Preferences</button>
                    </div>
                </form>
            </div>`;
    }

    function renderCard(job, score) {
        const isSaved = savedJobIds.includes(job.id);
        const sourceBadge = getSourceBadgeClass(job.source);
        const matchBadge = getMatchBadgeHTML(score); // Uses corrected logic

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
        // (Same logic as before, just ensuring it uses the updated renderCard)
        const container = document.getElementById('job-grid-container');
        if (!container) return;

        let processed = JOB_DATA.map(job => ({ ...job, score: calculateMatchScore(job) }));

        let filtered = processed.filter(job => {
            const matchKeyword = (job.title + job.company).toLowerCase().includes(filters.keyword.toLowerCase());
            const matchLoc = filters.location ? job.location.includes(filters.location) : true;
            const matchMode = filters.mode ? job.mode === filters.mode : true;
            const matchExp = filters.experience ? job.experience === filters.experience : true;
            const matchSource = filters.source ? job.source.includes(filters.source) : true;
            const matchThreshold = filters.showOnlyMatches ? job.score >= preferences.minMatchScore : true;
            return matchKeyword && matchLoc && matchMode && matchExp && matchSource && matchThreshold;
        });

        if (filters.sort === 'latest') filtered.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
        else if (filters.sort === 'match') filtered.sort((a, b) => b.score - a.score);
        else if (filters.sort === 'oldest') filtered.sort((a, b) => b.postedDaysAgo - a.postedDaysAgo);

        if (filtered.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>No matches found.</h3><p>Adjust filters or threshold.</p></div>`;
            return;
        }

        const banner = (!preferences.roleKeywords && !preferences.skills) ?
            `<div class="empty-state" style="grid-column:1/-1; background:#E3F2FD; margin-bottom:24px;"><p style="margin:0; color:#0D47A1;"><strong>Tip:</strong> Set preferences for better matches.</p></div>` : '';

        container.innerHTML = banner + filtered.map(job => renderCard(job, job.score)).join('');
    }

    window.saveSettings = function (e) {
        e.preventDefault();
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
        alert('Preferences Saved!');
        window.location.hash = '#dashboard';
    };

    function getSourceBadgeClass(source) {
        if (source.includes('LinkedIn')) return 'badge-linkedin';
        if (source.includes('Naukri')) return 'badge-naukri';
        if (source.includes('Indeed')) return 'badge-indeed';
        return 'badge-other';
    }

    function renderView() {
        let hash = window.location.hash.substring(1).toLowerCase();
        if (!hash) {
            appView.innerHTML = `
            <div class="hero-section">
                <h1 class="hero-title">Stop Missing The Right Jobs.</h1>
                <p class="hero-subtext">Precision-matched job discovery delivered daily at 9AM.</p>
                <div class="hero-actions"><a href="#dashboard" class="btn btn-primary btn-lg">View Jobs</a></div>
            </div>`;
            return;
        }

        updateActiveNav(hash);

        if (hash === 'dashboard') {
            appView.innerHTML = getDashboardHTML();
            filterAndRenderDashboard();
            attachDashboardListeners();
        } else if (hash === 'saved') {
            appView.innerHTML = `<div class="view-header"><h1 class="view-title">Saved Jobs</h1></div><div id="saved-grid-container" class="job-grid"></div><div id="job-modal" class="modal-overlay"><div class="modal-content"><button class="modal-close">&times;</button><div id="modal-body"></div></div></div>`;
            const saved = JOB_DATA.filter(j => savedJobIds.includes(j.id));
            const container = document.getElementById('saved-grid-container');
            if (saved.length === 0) container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>No saved jobs.</h3></div>`;
            else container.innerHTML = saved.map(j => renderCard(j, calculateMatchScore(j))).join('');
        } else if (hash === 'digest') {
            renderDigestView();
        } else if (hash === 'settings') {
            appView.innerHTML = getSettingsHTML();
            document.getElementById('settings-form').addEventListener('submit', window.saveSettings);
        } else if (hash === 'proof') {
            appView.innerHTML = `<div class="view-header"><h1 class="view-title">Verification Proof</h1></div><div class="card"><div class="proof-list"><div class="proof-item"><input type="checkbox" checked disabled><label>Digest Engine</label></div><div class="proof-item"><input type="checkbox" checked disabled><label>Match Logic</label></div></div></div>`;
        }

        const mobileNav = document.querySelector('.mobile-nav');
        if (mobileNav && mobileNav.classList.contains('open')) mobileNav.classList.remove('open');
    }

    function attachDashboardListeners() {
        ['keyword', 'location', 'mode', 'experience', 'source', 'sort'].forEach(key => {
            const el = document.getElementById(`filter-${key}`);
            if (el) el.addEventListener('input', (e) => { filters[key] = e.target.value; filterAndRenderDashboard(); });
        });
        const toggle = document.getElementById('toggle-matches');
        if (toggle) toggle.addEventListener('change', (e) => { filters.showOnlyMatches = e.target.checked; filterAndRenderDashboard(); });
    }

    function updateActiveNav(hash) {
        navItems.forEach(item => {
            if (item.getAttribute('href') === `#${hash}`) item.classList.add('active');
            else item.classList.remove('active');
        });
    }

    window.openJobModal = function (jobId) {
        const job = JOB_DATA.find(j => j.id === jobId);
        if (!job) return;
        const modal = document.getElementById('job-modal');
        const body = document.getElementById('modal-body');
        body.innerHTML = `<div class="modal-title">${job.title}</div><div class="modal-subtitle">${job.company} • ${job.location}</div><div class="modal-desc">${job.description}</div><div style="margin-top:20px;">Score: ${calculateMatchScore(job)}%</div><div style="margin-top:24px;"><button class="btn btn-secondary" onclick="document.querySelector('.modal-close').click()">Close</button></div>`;
        modal.classList.add('active');
        modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
        document.querySelector('.modal-close').onclick = () => modal.classList.remove('active');
    };

    window.toggleSave = function (jobId) {
        if (savedJobIds.includes(jobId)) savedJobIds = savedJobIds.filter(id => id !== jobId);
        else savedJobIds.push(jobId);
        localStorage.setItem('savedJobs', JSON.stringify(savedJobIds));
        if (window.location.hash === '#dashboard') filterAndRenderDashboard();
        else if (window.location.hash === '#saved') renderView();
    };

    window.addEventListener('hashchange', renderView);
    renderView(); // Initial
});
