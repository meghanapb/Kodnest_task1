document.addEventListener('DOMContentLoaded', () => {
    // Copy Prompt Functionality
    const copyBtn = document.querySelector('.secondary-panel .btn-sm');
    const promptContent = document.querySelector('.prompt-content');

    if (copyBtn && promptContent) {
        copyBtn.addEventListener('click', () => {
            const originalText = copyBtn.innerText;
            const textToCopy = promptContent.innerText.trim();

            navigator.clipboard.writeText(textToCopy).then(() => {
                copyBtn.innerText = 'Copied!';
                copyBtn.classList.add('btn-primary');
                copyBtn.classList.remove('btn-secondary');
                
                setTimeout(() => {
                    copyBtn.innerText = originalText;
                    copyBtn.classList.remove('btn-primary');
                    copyBtn.classList.add('btn-secondary');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
    }

    // Proof Footer Logic (Visual Feedback)
    const checks = document.querySelectorAll('.proof-check');
    const statusBadge = document.querySelector('.status-badge');

    function updateStatus() {
        const allChecked = Array.from(checks).every(checkbox => checkbox.checked);
        if (allChecked) {
            statusBadge.textContent = 'Shipped';
            statusBadge.classList.remove('status-in-progress');
            statusBadge.style.backgroundColor = 'var(--success-color)';
            statusBadge.style.color = '#FFFFFF';
            statusBadge.style.borderColor = 'transparent';
        } else {
             // Reset to in-progress if unchecked
            const someChecked = Array.from(checks).some(checkbox => checkbox.checked);
            if (someChecked) {
                 statusBadge.textContent = 'In Progress';
                 // Revert styles would be needed here if we change them dynamically often
                 // For now, simpler is better.
            }
        }
    }

    checks.forEach(check => {
        check.addEventListener('change', updateStatus);
    });
});
