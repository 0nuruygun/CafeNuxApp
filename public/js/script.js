const form = document.querySelector('form');
form.addEventListener('submit', (e) => {
    const captchaResponse = grecaptcha.getResponse();
    if (!captchaResponse.length > 0) {
        e.preventDefault();
        alert("Lütfen kutuyu işaretleyin.")
    }
});	