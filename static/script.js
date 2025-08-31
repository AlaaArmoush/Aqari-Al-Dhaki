class RealEstatePredictorApp {
    judgeResultElGlobal = null;
    constructor() {
        this.currentLang = "ar"
        this.currentTheme = "dark"
        this.lastPredictedPrice = null;
        this.currentJudgmentColor = null;
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

        const judgePriceBtn = document.getElementById("judgePriceBtn");
        judgePriceBtn.addEventListener("click", () => this.judgePrice());
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
        const savedTheme = localStorage.getItem("theme") || "dark"
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
        const rawFloor = document.getElementById("floor").value.trim();
        const roof = document.getElementById("roof").checked;

        let floor;
        if (roof && rawFloor > 2) {
            floor = 11;
        } else {
            switch (rawFloor.toUpperCase()) {
                case "B": floor = -2; break;
                case "P": floor = -1; break;
                case "GF": floor = 0; break;
                default:
                    floor = parseInt(rawFloor, 10);
                    if (isNaN(floor)) floor = 0;
                    if (floor > 10) floor = 10;
            }
        }

        return {
            buildingArea: Number.parseFloat(document.getElementById("buildingArea").value),
            buildingAge: Number.parseInt(document.getElementById("buildingAge").value),
            rooms: Number.parseInt(document.getElementById("rooms").value),
            bathrooms: Number.parseInt(document.getElementById("bathrooms").value),
            floor: floor,
            paymentMethod: document.getElementById("paymentMethod").value,
            city: document.getElementById("city").value,
            furnished: document.getElementById("furnished").checked,
            parking: document.getElementById("parking").checked,
            garden: document.getElementById("garden").checked,
        };
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

        document.getElementById("compareListedPrice").style.display = "none";
        document.getElementById("judgeResult").style.display = "none";
        document.getElementById("marketCanvas").style.display = "none";
        document.getElementById("listedPriceInput").value = "";

        predictBtn.classList.add("loading");
        predictBtn.disabled = true;
        resultsCard.classList.add("loading");

        try {
            const API_URL = "/predict";

            const payload = {
                "عدد_الغرف": data.rooms,
                "عدد_الحمامات": data.bathrooms,
                "مفروشة": data.furnished ? 1 : 0,
                "مساحة_البناء": data.buildingArea,
                "الطابق": data.floor,
                "عمر_البناء": data.buildingAge,
                "العقار_مرهون": data.garden ? 1 : 0,
                "طريقة_الدفع": this.mapPaymentMethod(data.paymentMethod),
                "موقف_سيارات": data.parking ? 1 : 0,
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
            this.updatePriceBreakdown(result.factors);
            priceBreakdown.style.display = "block";

            document.getElementById("compareListedPrice").style.display = "block";

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

    async judgePrice() {
        const listedPriceInput = document.getElementById("listedPriceInput");
        const judgeResultEl = document.getElementById("judgeResult");
        const listedPrice = parseFloat(listedPriceInput.value);

        if (!listedPrice || isNaN(listedPrice)) {
            judgeResultEl.textContent = this.currentLang === 'en' ? "Please enter a valid price." : "الرجاء إدخال سعر صحيح.";
            judgeResultEl.style.color = "var(--error-color)";
            judgeResultEl.style.display = "block";
            return;
        }

        judgeResultEl.textContent = this.currentLang === 'en' ? 'Analyzing...' : 'يتم التحليل...';
        judgeResultEl.style.color = 'var(--text-secondary)';
        judgeResultEl.style.display = 'block';

        const formData = this.collectFormData();
        const payload = {
            ...this.mapDataToBackend(formData),
            listed_price: listedPrice
        };

        try {
            const response = await fetch('/judge_price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Judgment API error');
            const result = await response.json();

            this.displayJudgmentResult(result);

        } catch (error) {
            console.error(error);
            judgeResultEl.textContent = this.currentLang === 'en' ? 'Could not get analysis.' : 'تعذر الحصول على التحليل.';
            judgeResultEl.style.color = 'var(--error-color)';
        }
    }

    mapDataToBackend(data) {
        return {
            "عدد_الغرف": data.rooms,
            "عدد_الحمامات": data.bathrooms,
            "مفروشة": data.furnished ? 1 : 0,
            "مساحة_البناء": data.buildingArea,
            "الطابق": data.floor,
            "عمر_البناء": data.buildingAge,
            "العقار_مرهون": data.garden ? 1 : 0,
            "طريقة_الدفع": this.mapPaymentMethod(data.paymentMethod),
            "موقف_سيارات": data.parking ? 1 : 0,
            "المدينة": this.mapCity(data.city),
        };
    }

    displayJudgmentResult(result) {
        this.judgeResultElGlobal = document.getElementById("judgeResult");

        const messages = {
            en: {
                OVERPRICED: "This appears to be significantly overpriced compared to its expected market range.",
                FAIR_PRICE: "This price is high within the expected market range.",
                PREDICTED_PRICE: "This price is within the fair market range.",
                GOOD_DEAL: "This looks like an excellent deal, priced below its typical market range.",
                FAIR_LOW: "This price is a bit low compared to market value — could be fine, but worth double-checking.",
                SUSPICIOUSLY_UNDERPRICED: "This price is suspiciously low compared to the market range."
            },
            ar: {
                OVERPRICED: "يبدو أن السعر مبالغ فيه بشكل كبير مقارنة بالنطاق السوقي المتوقع.",
                FAIR_PRICE: "السعر مرتفع و لكن ضمن النطاق المتوقع للسوق.",
                PREDICTED_PRICE: "السعر ضمن النطاق العادل للسوق.",
                GOOD_DEAL: "سعر ممتاز — أقل من المعتاد في السوق ويمثل صفقة جيدة.",
                FAIR_LOW: "السعر أقل من النطاق السوقي المتوقع، قد يكون فرصة ولكن يستحق التحقق.",
                SUSPICIOUSLY_UNDERPRICED: "السعر منخفض بشكل مريب مقارنة بالنطاق السوقي."
            }
        };

        const colors = {
            OVERPRICED: '#d9534f',  
            FAIR_PRICE: '#f0ad4e',   
            PREDICTED_PRICE: '#4fc3c7',
            FAIR_LOW: '#f0ad4e',   
            GOOD_DEAL: '#5cb85c',   
            SUSPICIOUSLY_UNDERPRICED: '#d9534f' 
        };

        this.judgeResultElGlobal.textContent = messages[this.currentLang][result.judgment_key] || '';
        this.judgeResultElGlobal.style.backgroundColor = colors[result.judgment_key] || '#777'; 
        this.currentJudgmentColor = colors[result.judgment_key] || '#777';
        this.judgeResultElGlobal.style.color = '#fff'; 
        this.judgeResultElGlobal.style.padding = "10px";
        this.judgeResultElGlobal.style.borderRadius = "8px";
        this.judgeResultElGlobal.style.display = "block";

        this.drawMarketCanvas(result);
    }

    drawMarketCanvas(result) {
        const canvas = document.getElementById("marketCanvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth || 520;
        const cssH = 280;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas.style.width = cssW + "px";
        canvas.style.height = cssH + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const s = getComputedStyle(document.documentElement);
        const borderColor = s.getPropertyValue('--border-color').trim() || '#dee2e6';
        const bgPrimary = s.getPropertyValue('--bg-primary').trim() || '#ffffff';
        const textSecondary = s.getPropertyValue('--text-secondary').trim() || '#6c757d';

        const min = result.price_range ? result.price_range[0] : 0;
        const max = result.price_range ? result.price_range[1] : 1;
        const listed = (result.listed_price !== undefined) ? result.listed_price : null;

        const paddingLeft = 60;
        const paddingRight = 20;
        const left = paddingLeft;
        const right = cssW - paddingRight;
        const usable = Math.max(10, right - left);
        const barY = cssH / 2 - 20;
        const barHeight = 24;

        ctx.clearRect(0, 0, cssW, cssH);
        ctx.fillStyle = bgPrimary;
        ctx.fillRect(0, 0, cssW, cssH);

        ctx.fillStyle = textSecondary;
        ctx.font = "14px Tajawal, sans-serif";
        ctx.textAlign = "left";
        const title = (this.currentLang === "ar") ? "نطاق السوق (تقديري)" : "Market range (estimate)";
        ctx.fillText(title, 10, 20);

        const rangeWidth = Math.max(1e-9, max - min);
        const scale = (v) => left + ((Math.max(min, Math.min(max, v)) - min) / rangeWidth) * usable;

        ctx.fillStyle = "#f8f9fa";
        ctx.fillRect(left, barY, usable, barHeight);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(left, barY, usable, barHeight);

        if (result.hist && Array.isArray(result.hist.counts) && Array.isArray(result.hist.edges)) {
            const counts = result.hist.counts;
            const edges = result.hist.edges;
            const maxCount = Math.max(...counts, 1);
            const histTop = barY - 50;
            
            ctx.fillStyle = "#4fc3c7";
            ctx.globalAlpha = 0.7;
            for (let i = 0; i < counts.length; i++) {
                const x0 = scale(edges[i]);
                const x1 = scale(edges[i + 1]);
                const bw = Math.max(1, x1 - x0 - 1);
                const hbar = (counts[i] / maxCount) * 40;
                ctx.fillRect(x0, histTop + (40 - hbar), bw, hbar);
            }
            ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, barY + barHeight + 10);
        ctx.lineTo(right, barY + barHeight + 10);
        ctx.stroke();

        ctx.fillStyle = textSecondary;
        ctx.font = "11px Tajawal, sans-serif";
        ctx.textAlign = "center";
        
        const numTicks = 6;
        for (let i = 0; i <= numTicks; i++) {
            const val = min + (i / numTicks) * (max - min);
            const x = scale(val);
            
            ctx.strokeStyle = borderColor;
            ctx.beginPath();
            ctx.moveTo(x, barY + barHeight + 8);
            ctx.lineTo(x, barY + barHeight + 15);
            ctx.stroke();
            
            const formattedVal = this.formatPriceShort(val);
            ctx.fillStyle = textSecondary;
            ctx.fillText(formattedVal, x, barY + barHeight + 30);
        }

        ctx.fillStyle = textSecondary;
        ctx.font = "12px Tajawal, sans-serif";
        ctx.textAlign = "center";
        
        if (listed !== null && !isNaN(listed)) {
            const listedColor = this.currentJudgmentColor || "#ff0000";
            const x = scale(listed);

            ctx.beginPath();
            ctx.moveTo(x, barY - 10);
            ctx.lineTo(x, barY + barHeight + 20);
            ctx.lineWidth = 3;
            ctx.strokeStyle = listedColor;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, barY + barHeight / 2, 5, 0, Math.PI * 2);
            ctx.fillStyle = listedColor;
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = listedColor;
            ctx.font = "bold 12px Tajawal, sans-serif";
            ctx.textAlign = "center";
            const label = (this.currentLang === "ar" ? "المعروض: " : "Listed: ") + this.formatPriceShort(listed);
            ctx.fillText(label, x, barY - 20);
        }

        canvas.style.display = "block";
    }

    formatPriceShort(price) {
        const rounded = Math.round(price);
        if (rounded >= 1000000) {
            return (rounded / 1000000).toFixed(1) + (this.currentLang === "ar" ? "مل" : "M");
        } else if (rounded >= 1000) {
            return (rounded / 1000).toFixed(0) + (this.currentLang === "ar" ? "الف" : "K");
        } else {
            return rounded.toString();
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

        if (data.paymentMethod === "cash") {
            adjustedPrice *= 0.95
        }

        return Math.round(adjustedPrice)
    }

    updatePriceBreakdown(factors) {
        const factorList = document.querySelector(".factor-list");
        factorList.innerHTML = "";
        const factorArray = Object.entries(factors).map(([feature, impact]) => ({ feature, impact }));

        factorArray.forEach(f => {
            const div = document.createElement("div");
            div.classList.add("factor-item");

            const name = document.createElement("span");
            name.textContent = f.feature;

            const impact = document.createElement("span");
            const sign = f.impact >= 0 ? "+" : "";
            impact.textContent = `${sign}${f.impact.toFixed(2)}%`;
            impact.classList.add("factor-impact");
            impact.style.color = f.impact >= 0 ? "var(--success-color)" : "var(--error-color)";

            div.appendChild(name);
            div.appendChild(impact);
            factorList.appendChild(div);
        });
    }

    formatPrice(price) {
        const rounded = Math.round(price);
        if (this.currentLang === "ar") {
            return rounded.toLocaleString("ar-EG");
        } else {
            return rounded.toLocaleString("en-US");
        }
    }

    showError(message) {
        alert(message)
    }

    loadSavedLanguage() {
        const savedLang = localStorage.getItem("language") || "ar"
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