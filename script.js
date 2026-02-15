document.addEventListener('DOMContentLoaded', () => {

    const appView = document.getElementById('app-view');
    const navItems = document.querySelectorAll('.nav-item');
    let modalOverlay;

    // --- State ---
    let savedJobIds = JSON.parse(localStorage.getItem('savedJobs')) || [];
    let jobStatus = JSON.parse(localStorage.getItem('jobTrackerStatus')) || {};
    let statusLog = JSON.parse(localStorage.getItem('jobTrackerStatusLog')) || [];
    let testState = JSON.parse(localStorage.getItem('jobTrackerTestState')) || { checks: [], completed: false };

    // NEW: Submission State
    let submissionState = JSON.parse(localStorage.getItem('jobTrackerSubmission')) || {
        lovable: '',
        github: '',
        deployed: '',
        shipped: false
    };

    let preferences = JSON.parse(localStorage.getItem('jobTrackerPreferences')) || {
        roleKeywords: '',
        preferredLocations: '',
        preferredMode: ['any'],
        experienceLevel: '',
        skills: '',
        minMatchScore: 40
    };

    let filters = {
        keyword: '',
        location: '',
        mode: '',
        experience: '',
        source: '',
        status: '',
        sort: 'latest',
        showOnlyMatches: false
    };

    // --- Configuration ---
    const TEST_ITEMS = [
        { id: 1, text: "Preferences persist after refresh", tip: "Reload page and check settings." },
        { id: 2, text: "Match score calculates correctly", tip: "Verify percentages on dashboard." },
        { id: 3, text: "\"Show only matches\" toggle works", tip: "Toggle and check list." },
        { id: 4, text: "Save job persists after refresh", tip: "Save a job, reload, check Saved tab." },
        { id: 5, text: "Apply opens in new tab", tip: "Click Apply on any job." },
        { id: 6, text: "Status update persists after refresh", tip: "Change status, reload." },
        { id: 7, text: "Status filter works correctly", tip: "Filter by 'Applied' etc." },
        { id: 8, text: "Digest generates top 10 by score", tip: "Check Digest tab content." },
        { id: 9, text: "Digest persists for the day", tip: "Reload page, digest should stay." },
        { id: 10, text: "No console errors on main pages", tip: "Open DevTools > Console." }
    ];

    if (testState.checks.length !== TEST_ITEMS.length) {
        testState.checks = new Array(TEST_ITEMS.length).fill(false);
    }

    // --- Match Score Engine ---
    function calculateMatchScore(job) {
        if (!preferences.roleKeywords && !preferences.skills) return 0;

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

    // --- Status Logic ---
    window.updateJobStatus = function (jobId, newStatus) {
        jobStatus[jobId] = newStatus;
        localStorage.setItem('jobTrackerStatus', JSON.stringify(jobStatus));

        const job = JOB_DATA.find(j => j.id === jobId);
        if (job) {
            const logEntry = {
                jobId: jobId,
                title: job.title,
                company: job.company,
                status: newStatus,
                date: new Date().toISOString()
            };
            statusLog.unshift(logEntry);
            if (statusLog.length > 50) statusLog.pop();
            localStorage.setItem('jobTrackerStatusLog', JSON.stringify(statusLog));
        }
        showToast(`Status updated: ${formatStatus(newStatus)}`);
        if (window.location.hash === '#dashboard') filterAndRenderDashboard();
        else if (window.location.hash === '#saved') renderView();
    };

    function formatStatus(status) {
        if (status === 'not-applied') return 'Not Applied';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    function showToast(message) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // --- Digest Engine ---
    function getTodayDigestKey() {
        const today = new Date().toISOString().split('T')[0];
        return `jobTrackerDigest_${today}`;
    }

    function generateDigest() {
        const scoredJobs = JOB_DATA.map(j => ({ ...j, score: calculateMatchScore(j) }));
        const viableJobs = scoredJobs.filter(j => j.score >= preferences.minMatchScore);
        if (viableJobs.length === 0) return null;
        viableJobs.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.postedDaysAgo - b.postedDaysAgo;
        });
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
            appView.innerHTML = `
                <div class="view-header"><h1 class="view-title">Daily Digest</h1></div>
                <div class="empty-state">
                    <div class="empty-icon-large">📨</div>
                    <h3>Your 9AM Digest is ready.</h3>
                    <p>Generate your personalized list of top opportunities for today.</p>
                    <button class="btn btn-primary btn-lg" onclick="triggerDigestGeneration()">Generate Today's 9AM Digest (Simulated)</button>
                    ${statusLog.length > 0 ? getRecentUpdatesHTML() : ''} 
                    <p style="margin-top:20px; font-size:12px; color:#999;">Demo Mode: Daily 9AM trigger simulated manually.</p>
                </div>`;
        } else {
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
            const updatesHTML = statusLog.length > 0 ? `
                <div class="digest-header" style="margin-top:20px; border-top:1px solid #E0E0E0;">
                    <div class="digest-title" style="font-size:18px;">Recent Status Updates</div>
                </div>
                <div class="digest-body">
                    ${statusLog.slice(0, 5).map(log => `
                        <div class="digest-item">
                            <div style="font-size:13px;">
                                <strong>${log.title}</strong> @ ${log.company}
                            </div>
                            <div style="font-size:12px; font-weight:600; color:${getStatusColor(log.status)};">
                                ${formatStatus(log.status)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '';
            appView.innerHTML = `
                <div class="view-header" style="text-align:center;"><h1 class="view-title">Daily Digest</h1></div>
                <div class="digest-container">
                    <div class="digest-header">
                        <div class="digest-title">Top 10 Jobs For You</div>
                        <div class="digest-date">${todayStr}</div>
                    </div>
                    <div class="digest-body">${listHTML}</div>
                    ${updatesHTML}
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

    function getRecentUpdatesHTML() {
        return `
            <div style="margin-top:40px; text-align:left; max-width:400px; margin-left:auto; margin-right:auto;">
                <h4 style="font-family:var(--font-serif); border-bottom:1px solid #ddd; padding-bottom:8px;">Recent Activity</h4>
                ${statusLog.slice(0, 3).map(log => `
                    <div style="display:flex; justify-content:space-between; padding:8px 0; font-size:13px; border-bottom:1px solid #f0f0f0;">
                         <span>${log.title}</span>   
                         <span style="color:${getStatusColor(log.status)}; font-weight:600;">${formatStatus(log.status)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function getScoreColor(score) {
        if (score >= 80) return '#2E7D32';
        if (score >= 60) return '#F57F17';
        if (score >= 40) return '#546E7A';
        return '#9E9E9E';
    }

    function getStatusColor(status) {
        if (status === 'applied') return '#1565C0';
        if (status === 'rejected') return '#C62828';
        if (status === 'selected') return '#2E7D32';
        return '#757575';
    }

    window.triggerDigestGeneration = function () {
        const result = generateDigest();
        if (!result) alert('No matching roles found today based on your preferences.');
        else renderDigestView();
    };

    window.copyDigestText = function () {
        const digest = JSON.parse(localStorage.getItem(getTodayDigestKey()));
        if (!digest) return;
        let text = `My 9AM Job Digest - ${new Date().toLocaleDateString()}\n\n`;
        digest.forEach(j => { text += `${j.title} at ${j.company} (${j.score}% Match)\n${j.location} | ${j.salaryRange}\nApply: ${j.applyUrl}\n\n`; });
        navigator.clipboard.writeText(text).then(() => alert('Digest copied to clipboard!'));
    };

    window.sendDigestEmail = function () {
        const digest = JSON.parse(localStorage.getItem(getTodayDigestKey()));
        if (!digest) return;
        let body = `Here are my top job matches for today:\n\n`;
        digest.forEach(j => { body += `${j.title} at ${j.company} (${j.score}% Match)\n${j.location}\n${j.applyUrl}\n\n`; });
        window.open(`mailto:?subject=My 9AM Job Digest&body=${encodeURIComponent(body)}`);
    };

    // --- Test Checklist Logic ---
    window.toggleTestItem = function (index) {
        testState.checks[index] = !testState.checks[index];
        const allChecked = testState.checks.every(Boolean);
        testState.completed = allChecked;
        localStorage.setItem('jobTrackerTestState', JSON.stringify(testState));
        renderTestView();
        checkProofLock();
    };

    window.resetTestStatus = function () {
        testState = { checks: new Array(TEST_ITEMS.length).fill(false), completed: false };
        localStorage.setItem('jobTrackerTestState', JSON.stringify(testState));
        renderTestView();
        checkProofLock();
    };

    function checkProofLock() {
        const proofNav = document.getElementById('nav-proof');
        const mobileProofNav = document.getElementById('mobile-nav-proof');

        if (testState.completed) {
            if (proofNav) proofNav.classList.remove('locked');
            if (mobileProofNav) mobileProofNav.classList.remove('locked');
        } else {
            if (proofNav) proofNav.classList.add('locked');
            if (mobileProofNav) mobileProofNav.classList.add('locked');
        }
    }

    function renderTestView() {
        const passedCount = testState.checks.filter(Boolean).length;
        const totalCount = TEST_ITEMS.length;
        const progressPercent = (passedCount / totalCount) * 100;
        const isWarning = passedCount < totalCount;

        const listHTML = TEST_ITEMS.map((item, index) => `
            <div class="test-item">
                <input type="checkbox" class="test-checkbox" 
                    ${testState.checks[index] ? 'checked' : ''} 
                    onchange="toggleTestItem(${index})">
                <label class="test-label" onclick="this.previousElementSibling.click()">
                    ${item.text}
                    ${item.tip ? `<span class="test-tooltip" title="${item.tip}">?</span>` : ''}
                </label>
            </div>
        `).join('');

        appView.innerHTML = `
            <div class="view-header">
                <h1 class="view-title">Test Verification</h1>
                <p class="view-subtext">Route 07: Verify all features before shipping.</p>
            </div>
            <div class="test-card">
                <div class="progress-header">
                    <div class="progress-title">Tests Passed: ${passedCount} / ${totalCount}</div>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${progressPercent}%;"></div></div>
                    ${isWarning ? `<div class="progress-warn">Resolve all issues before shipping.</div>` : ''}
                </div>
                <div class="test-list">${listHTML}</div>
                <div style="padding:20px; text-align:center; background:#f9f9f9; border-top:1px solid #eee;">
                    <button class="btn btn-secondary" onclick="resetTestStatus()" style="font-size:12px;">Reset Test Status</button>
                </div>
            </div>
        `;
    }

    // --- Final Proof & Submission Logic ---

    const PROJECT_STEPS = [
        "Core Project Setup", "App Shell & Navigation", "Job Data Engine", "Match Score Logic",
        "Dashboard Filters", "Daily Digest System", "Status Tracking", "Test Verification"
    ];

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function renderProofView() {
        const filled = submissionState.lovable && submissionState.github && submissionState.deployed;
        const isShipped = submissionState.shipped;

        let statusText = 'Not Started';
        let statusClass = 'pending';

        if (isShipped) {
            statusText = 'Shipped';
            statusClass = 'shipped';
        } else if (filled) {
            statusText = 'In Progress';
            statusClass = 'pending';
        }

        const stepHTML = PROJECT_STEPS.map(step => `
            <div class="step-item">
                <span class="step-icon">✔</span> ${step}
            </div>
        `).join('');

        appView.innerHTML = `
             <div class="view-header">
                <h1 class="view-title">Project 1 — Job Notification Tracker</h1>
                <p class="view-subtext">Final Proof & Submission Dashboard</p>
            </div>
            
            <div style="text-align:center;">
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>

            <div class="submission-card">
                <div class="step-summary">
                    ${stepHTML}
                </div>

                <div style="border-top:1px solid #eee; margin-bottom:24px;"></div>

                <h3 style="font-size:16px; margin-bottom:16px;">Artifact Collection</h3>
                
                <form id="submission-form" onsubmit="window.saveSubmissionDetails(event)">
                    <div class="form-group">
                        <label class="input-label">Lovable Project Link</label>
                        <input type="url" id="link-lovable" class="input-field" placeholder="https://lovable.dev/..." value="${submissionState.lovable}" required>
                    </div>
                    <div class="form-group">
                        <label class="input-label">GitHub Repository</label>
                        <input type="url" id="link-github" class="input-field" placeholder="https://github.com/..." value="${submissionState.github}" required>
                    </div>
                    <div class="form-group">
                        <label class="input-label">Deployed URL</label>
                        <input type="url" id="link-deployed" class="input-field" placeholder="https://vercel.com/..." value="${submissionState.deployed}" required>
                    </div>
                    
                    <div style="margin-top:24px; display:flex; gap:12px;">
                        <button type="submit" class="btn btn-primary" style="flex:1;">Save Actions</button>
                        <button type="button" class="btn btn-secondary" onclick="window.copySubmission()" style="flex:1;">Copy Final Submission</button>
                    </div>
                </form>

                ${isShipped ? `<div class="shipped-message">Project 1 Shipped Successfully.</div>` : ''}
            </div>
        `;
    }

    window.saveSubmissionDetails = function (e) {
        e.preventDefault();
        const lovable = document.getElementById('link-lovable').value;
        const github = document.getElementById('link-github').value;
        const deployed = document.getElementById('link-deployed').value;

        if (!isValidUrl(lovable) || !isValidUrl(github) || !isValidUrl(deployed)) {
            alert('Please provide valid URLs including http:// or https://');
            return;
        }

        submissionState.lovable = lovable;
        submissionState.github = github;
        submissionState.deployed = deployed;

        // Ship Conditions: All Tests Passed + All 3 Links Valid
        if (testState.completed && lovable && github && deployed) {
            submissionState.shipped = true;
        } else {
            submissionState.shipped = false;
        }

        localStorage.setItem('jobTrackerSubmission', JSON.stringify(submissionState));
        renderProofView();
    };

    window.copySubmission = function () {
        if (!submissionState.shipped) {
            alert('Cannot copy. Complete all tests and provide all links to Ship first.');
            return;
        }

        const text = `Job Notification Tracker — Final Submission\n\nLovable Project:\n${submissionState.lovable}\n\nGitHub Repository:\n${submissionState.github}\n\nLive Deployment:\n${submissionState.deployed}\n\nCore Features:\n- Intelligent match scoring\n- Daily digest simulation\n- Status tracking\n- Test checklist enforced`;

        navigator.clipboard.writeText(text).then(() => {
            alert('Submission copied to clipboard!');
        });
    };

    // --- View Logic ---

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
                <select id="filter-status" class="filter-select">
                    <option value="">Status (All)</option>
                    <option value="not-applied">Not Applied</option>
                    <option value="applied">Applied</option>
                    <option value="rejected">Rejected</option>
                    <option value="selected">Selected</option>
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
        const matchBadge = getMatchBadgeHTML(score);

        const status = jobStatus[job.id] || 'not-applied';
        const statusClass = `status-${status}`;

        return `
            <div class="job-card ${statusClass}" data-id="${job.id}">
                ${matchBadge}
                <div class="job-card-header" style="margin-top: ${score > 0 ? '20px' : '0'};">
                    <div>
                        <div class="job-title">${job.title}</div>
                        <div class="job-company">${job.company}</div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                        <span class="badge-source ${sourceBadge}">${job.source}</span>
                         <select class="status-select ${status}" onchange="updateJobStatus('${job.id}', this.value)" title="Update Status">
                            <option value="not-applied" ${status === 'not-applied' ? 'selected' : ''}>Not Applied</option>
                            <option value="applied" ${status === 'applied' ? 'selected' : ''}>Applied</option>
                            <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>Rejected</option>
                            <option value="selected" ${status === 'selected' ? 'selected' : ''}>Selected</option>
                        </select>
                    </div>
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
        if (!container) return;

        let processed = JOB_DATA.map(job => ({ ...job, score: calculateMatchScore(job) }));

        let filtered = processed.filter(job => {
            const matchKeyword = (job.title + job.company).toLowerCase().includes(filters.keyword.toLowerCase());
            const matchLoc = filters.location ? job.location.includes(filters.location) : true;
            const matchMode = filters.mode ? job.mode === filters.mode : true;
            const matchExp = filters.experience ? job.experience === filters.experience : true;
            const matchSource = filters.source ? job.source.includes(filters.source) : true;
            const matchThreshold = filters.showOnlyMatches ? job.score >= preferences.minMatchScore : true;

            const currentStatus = jobStatus[job.id] || 'not-applied';
            const matchStatus = filters.status ? currentStatus === filters.status : true;

            return matchKeyword && matchLoc && matchMode && matchExp && matchSource && matchThreshold && matchStatus;
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

        // SHIP LOCK GUARD
        if (hash === 'proof' && !testState.completed) {
            alert('Proof route is locked. Unresolved issues remain.');
            window.location.hash = '#test';
            return;
        }

        updateActiveNav(hash);
        checkProofLock();

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
        } else if (hash === 'test') { // Route 07
            renderTestView();
        } else if (hash === 'proof') { // Route 08 (Final)
            renderProofView();
        }

        const mobileNav = document.querySelector('.mobile-nav');
        if (mobileNav && mobileNav.classList.contains('open')) mobileNav.classList.remove('open');
    }

    function attachDashboardListeners() {
        ['keyword', 'location', 'mode', 'experience', 'source', 'sort', 'status'].forEach(key => {
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
