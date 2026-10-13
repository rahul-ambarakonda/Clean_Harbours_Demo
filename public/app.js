
// Basic email validation function, mirroring server-side logic for client-side feedback.
// This is intentionally permissive.
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const trimmedEmail = email.trim();
  if (trimmedEmail.length === 0 || trimmedEmail.length > 254) {
    return false;
  }
  // Regex from API Contract: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const emailRegex = /^[^\s@]+@[^\s@]+\\.[^\\s@]{2,}$/;
  return emailRegex.test(trimmedEmail);
}

document.addEventListener('DOMContentLoaded', () => {
  const waitlistForm = document.getElementById('waitlist-form');
  const emailInput = document.getElementById('email');
  const waitlistStatus = document.getElementById('waitlist-status');
  const submitButton = waitlistForm.querySelector('.waitlist-submit-btn');

  if (!waitlistForm || !emailInput || !waitlistStatus || !submitButton) {
    console.error('Waitlist form elements not found. Client-side JS will not function.');
    return;
  }

  const resetFormState = () => {
    emailInput.value = '';
    emailInput.removeAttribute('aria-invalid');
    waitlistStatus.textContent = '';
    waitlistStatus.className = 'field__status'; // Reset class
    submitButton.disabled = false;
    submitButton.textContent = 'Join the waitlist';
  };

  const setStatusMessage = (message, type) => {
    waitlistStatus.textContent = message;
    waitlistStatus.className = `field__status field__status--${type}`;
    if (type === 'error') {
      emailInput.setAttribute('aria-invalid', 'true');
      waitlistStatus.setAttribute('role', 'alert');
      waitlistStatus.style.color = 'var(--color-negative)'; // Apply negative color for errors
    } else if (type === 'positive') {
      emailInput.removeAttribute('aria-invalid');
      waitlistStatus.removeAttribute('role');
      waitlistStatus.style.color = 'var(--color-positive)'; // Apply positive color for success
    } else {
        emailInput.removeAttribute('aria-invalid');
        waitlistStatus.removeAttribute('role');
        waitlistStatus.style.color = ''; // Reset color for other states (e.g., empty)
    }
  };

  waitlistForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Clear previous status messages
    setStatusMessage('', '');
    emailInput.removeAttribute('aria-invalid');

    const email = emailInput.value.trim();

    // Client-side validation
    if (!isValidEmail(email)) {
      setStatusMessage('That does not look like an email address.', 'error');
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
      return;
    }

    // Set in-flight state
    submitButton.disabled = true;
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Joining…';
    emailInput.setAttribute('aria-busy', 'true'); // Indicate busy state

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        let errorMessage = 'Something went wrong. Try again shortly.';
        let errorType = 'error';

        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            switch (response.status) {
              case 409: // Already on list
                errorMessage = 'You are already on the list.';
                errorType = 'positive'; // Display as positive as it\'s not a new error for user
                break;
              case 429: // Rate limited
                errorMessage = 'Too many attempts. Try again in a minute.';
                errorType = 'error';
                break;
              default:
                errorMessage = errorData.error.message || errorMessage;
            }
          }
        } catch (jsonError) {
          // If JSON parsing fails, use generic error message
          console.error('Failed to parse error response:', jsonError);
        }
        setStatusMessage(errorMessage, errorType);
        emailInput.setAttribute('aria-invalid', 'true');
        waitlistStatus.focus(); // Move focus to status on error
      } else {
        // Success (201 Created)
        setStatusMessage('You are on the list. We will email you once.', 'positive');
        emailInput.value = ''; // Clear input on success
        waitlistStatus.focus(); // Move focus to status on success
      }
    } catch (networkError) {
      console.error('Network error:', networkError);
      setStatusMessage('Something went wrong. Try again shortly.', 'error');
      emailInput.setAttribute('aria-invalid', 'true');
      waitlistStatus.focus(); // Move focus to status on error
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText; // Restore original button text
      emailInput.removeAttribute('aria-busy');
    }
  });
});
