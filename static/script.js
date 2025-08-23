class RealEstatePredictorApp {
    constructor() {
        this.currentLang = "en"
        this.currentTheme = "light"
        this.translations = {
            en: {},
            ar: {},
        }

        this.init()
    }

    init() {
        this.setupEventListeners()
        this.updateLanguage()
        this.loadTheme()
    }

    setupEventListeners() {
        const themeToggle = document.getElementById("themeToggle")
        themeToggle.addEventListener("click", () => this.toggleTheme())

        const langToggle = document.getElementById("langToggle")
        langToggle.addEventListener("click", () => this.toggleLanguage())

        window.addEventListener("click", (e) => {
            if (e.target.classList.contains("modal")) {
                e.target.style.display = "none"
            }
        })

        const form = document.getElementById("propertyForm")
        form.addEventListener("submit", (e) => this.handleFormSubmit(e))

        const inputs = form.querySelectorAll("input, select")
        inputs.forEach((input) => {
            input.addEventListener("input", () => this.validateInput(input))
        })
    }

    toggleTheme() {
        const body = document.body
        const themeIcon = document.querySelector(".theme-icon")

        if (this.currentTheme === "light") {
            body.classList.remove("light-mode")
            body.classList.add("dark-mode")
            themeIcon.textContent = "☀️"
            this.currentTheme = "dark"
        } else {
            body.classList.remove("dark-mode")
            body.classList.add("light-mode")
            themeIcon.textContent = "🌙"
            this.currentTheme = "light"
        }

        localStorage.setItem("theme", this.currentTheme)
    }

    loadTheme() {
        const savedTheme = localStorage.getItem("theme") || "light"
        const body = document.body
        const themeIcon = document.querySelector(".theme-icon")

        if (savedTheme === "dark") {
            body.classList.remove("light-mode")
            body.classList.add("dark-mode")
            themeIcon.textContent = "☀️"
            this.currentTheme = "dark"
        } else {
            body.classList.add("light-mode")
            themeIcon.textContent = "🌙"
            this.currentTheme = "light"
        }
    }

    toggleLanguage() {
        const newLang = this.currentLang === "en" ? "ar" : "en"
        this.switchLanguage(newLang)
    }

    switchLanguage(lang) {
        this.currentLang = lang

        const html = document.documentElement
        html.setAttribute("lang", lang)
        html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr")

        document.body.setAttribute("data-lang", lang)

        this.updateLanguage()
        localStorage.setItem("language", lang)
    }

    updateLanguage() {
        const elements = document.querySelectorAll("[data-en]")
        elements.forEach((element) => {
            const text = element.getAttribute(`data-${this.currentLang}`)
            if (text) {
                if (element.tagName === "INPUT" || element.tagName === "OPTION") {
                    element.textContent = text
                    if (element.hasAttribute("placeholder")) {
                        element.setAttribute("placeholder", text)
                    }
                } else {
                    element.textContent = text
                }
            }
        })

        const selects = document.querySelectorAll("select")
        selects.forEach((select) => {
            const options = select.querySelectorAll("option")
            options.forEach((option) => {
                const text = option.getAttribute(`data-${this.currentLang}`)
                if (text) {
                    option.textContent = text
                }
            })
        })
    }

    validateInput(input) {
        const value = input.value.trim()
        const isValid = input.checkValidity() && value !== ""

        input.style.borderColor = isValid ? "var(--primary-color)" : "var(--border-color)"

        return isValid
    }

    async handleFormSubmit(e) {
        e.preventDefault()

        const formData = this.collectFormData()
        const isValid = this.validateForm(formData)

        if (!isValid) {
            this.showError("Please fill in all required fields")
            return
        }

        await this.predictPrice(formData)
    }

    collectFormData() {
        return {
            buildingArea: Number.parseFloat(document.getElementById("buildingArea").value),
            buildingAge: Number.parseInt(document.getElementById("buildingAge").value),
            rooms: Number.parseInt(document.getElementById("rooms").value),
            bathrooms: Number.parseInt(document.getElementById("bathrooms").value),
            floor: Number.parseInt(document.getElementById("floor").value),
            paymentMethod: document.getElementById("paymentMethod").value,
            city: document.getElementById("city").value,
            furnished: document.getElementById("furnished").checked,
            parking: document.getElementById("parking").checked,
            garden: document.getElementById("garden").checked,
            elevator: document.getElementById("elevator").checked,
        }
    }

    validateForm(data) {
    const numericFields = ["buildingArea", "buildingAge", "rooms", "bathrooms", "floor"];
    const stringFields = ["paymentMethod", "city"];

    const numericValid = numericFields.every(field => data[field] !== "" && data[field] !== null && !isNaN(data[field]));
    const stringValid = stringFields.every(field => data[field] !== "" && data[field] !== null);

    return numericValid && stringValid;
}

 async predictPrice(data) {
    const predictBtn = document.getElementById("predictBtn");
    const resultsCard = document.getElementById("resultsCard");
    const priceDisplay = document.getElementById("predictedPrice");
    const priceBreakdown = document.getElementById("priceBreakdown");

    predictBtn.classList.add("loading");
    predictBtn.disabled = true;
    resultsCard.classList.add("loading");

    try {
        // Because frontend and backend are on the same Space, relative path works:
        const API_URL = "/predict";

        // Map UI → backend expected Arabic keys with underscores
        const payload = {
            "عدد_الغرف": data.rooms,
            "عدد_الحمامات": data.bathrooms,
            "مفروشة": data.furnished ? 1 : 0,
            "مساحة_البناء": data.buildingArea,
            "الطابق": data.floor,
            "عمر_البناء": data.buildingAge,
            "العقار_مرهون": data.garden ? 1 : 0,  // you labeled it "Property Mortgaged"
            "طريقة_الدفع": this.mapPaymentMethod(data.paymentMethod),
            "مصعد": data.elevator ? 1 : 0,
            "موقف_سيارات": data.parking ? 1 : 0,  // not used by model, but sent anyway
            "المدينة": this.mapCity(data.city),
        };

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("API error");
        const result = await response.json();

        const prediction = result.predicted_price;
        priceDisplay.textContent = this.formatPrice(prediction);
        this.updatePriceBreakdown(data);
        priceBreakdown.style.display = "block";

        resultsCard.style.transform = "scale(1.02)";
        setTimeout(() => { resultsCard.style.transform = "scale(1)"; }, 200);
    } catch (error) {
        this.showError("Failed to predict price. Please try again.");
        console.error(error);
    } finally {
        predictBtn.classList.remove("loading");
        predictBtn.disabled = false;
        resultsCard.classList.remove("loading");
    }
}

mapPaymentMethod(method) {
    switch (method) {
        case "cash": return 0;
        case "mortgage": return 1;
        case "installments": return 2;
        default: return 0;
    }
}

mapCity(code) {
    switch (code) {
        case "jerusalem": return "القدس";
        case "ramallah": return "رام الله";
        case "bethlehem": return "بيت لحم";
        case "nablus": return "نابلس";
        case "hebron": return "الخليل";
        case "jenin": return "جنين";
        case "tulkarem": return "طولكرم";
        default: return "أخرى";
    }
}

    calculateBasePrice(data) {
        const cityMultipliers = {
            jerusalem: 1.3,
            ramallah: 1.1,
            bethlehem: 0.9,
            nablus: 0.8,
            hebron: 0.7,
        }

        const baseRate = 2000
        const cityMultiplier = cityMultipliers[data.city] || 1

        return data.buildingArea * baseRate * cityMultiplier
    }

    applyAdjustments(basePrice, data) {
        let adjustedPrice = basePrice

        const ageDiscount = Math.min(data.buildingAge * 0.02, 0.3)
        adjustedPrice *= 1 - ageDiscount

        if (data.rooms > 3) {
            adjustedPrice *= 1.1
        }

        if (data.furnished) adjustedPrice *= 1.08
        if (data.parking) adjustedPrice *= 1.05
        if (data.garden) adjustedPrice *= 1.12
        if (data.elevator) adjustedPrice *= 1.06

        if (data.paymentMethod === "cash") {
            adjustedPrice *= 0.95
        }

        return Math.round(adjustedPrice)
    }

    updatePriceBreakdown(data) {
        const factors = document.querySelectorAll(".factor-impact")
        const impacts = ["+15%", "+25%", "-5%", "+8%"]

        factors.forEach((factor, index) => {
            if (impacts[index]) {
                factor.textContent = impacts[index]
                factor.style.color = impacts[index].startsWith("+") ? "var(--success-color)" : "var(--error-color)"
            }
        })
    }

    formatPrice(price) {
        return price.toLocaleString("en-US")
    }

    showError(message) {
        alert(message)
    }

    loadSavedLanguage() {
        const savedLang = localStorage.getItem("language") || "en"
        if (savedLang !== this.currentLang) {
            this.switchLanguage(savedLang)
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const app = new RealEstatePredictorApp()
    app.loadSavedLanguage()
})

document.addEventListener("DOMContentLoaded", () => {
    const inputs = document.querySelectorAll("input, select")
    inputs.forEach((input) => {
        input.addEventListener("focus", function () {
            this.parentElement.style.transform = "translateY(-1px)"
        })

        input.addEventListener("blur", function () {
            this.parentElement.style.transform = "translateY(0)"
        })
    })

    const buttons = document.querySelectorAll("button")
    buttons.forEach((button) => {
        button.addEventListener("click", function (e) {
            const ripple = document.createElement("span")
            const rect = this.getBoundingClientRect()
            const size = Math.max(rect.width, rect.height)
            const x = e.clientX - rect.left - size / 2
            const y = e.clientY - rect.top - size / 2

            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `

            this.style.position = "relative"
            this.style.overflow = "hidden"
            this.appendChild(ripple)

            setTimeout(() => ripple.remove(), 600)
        })
    })

    const style = document.createElement("style")
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }
    `
    document.head.appendChild(style)
})