import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://kikivfglslrobwttvlvn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpa2l2Zmdsc2xyb2J3dHR2bHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MTIwNDQsImV4cCI6MjA1MDA4ODA0NH0.Njo06GXSyZHjpjRwPJ2zpElJ88VYgqN2YYDfTJnBQ6k';

const supabase = createClient(supabaseUrl, supabaseKey);

const OPTIONS_IMPACT = {
    amr: { quality: -0.6, capacity: +5.3, delivery: +0.7 },
    ar: { quality: -0.6, capacity: +6.3, delivery: +0.7 },
    kitting: { quality: -0.6, capacity: +3.3, delivery: +0.7 },
    assembly: { quality: -0.6, capacity: +3.3, delivery: +0.7 },
    mes: { quality: -0.6, capacity: +3.3, delivery: +0.7 },
    pick: { quality: -0.6, capacity: +3.6, delivery: +0.7 },
    line: { quality: -0.5, capacity: +0, delivery: +0.8 }
};

const ACRONYM_DEFINITIONS = {
    amr: "Autonomous Mobile Robot",
    ar: "Augmented Reality",
    kitting: "Kit Preparation Process",
    assembly: "Assembly Line Optimization",
    mes: "Manufacturing Execution System",
    pick: "Pick-to-Light System",
    line: "Production Line Balancing"
};

const INDICATORS = {
    quality: { 
        title: "Quality", 
        target: 0.1,
        baseline: 4.0,
        min: 0.1,
        max: 4.0,
        isQuality: true,
        unit: " scrap/day",
        getPercentage: (value, baseline) => ((baseline - value) / baseline * 100).toFixed(1)
    },
    capacity: { 
        title: "Capacity", 
        target: 60,
        baseline: 37,
        min: 0,
        max: 70,
        isQuality: false,
        unit: "/h",
        getPercentage: (value, baseline) => ((value - baseline) / baseline * 100).toFixed(1)
    },
    delivery: { 
        title: "Delivery", 
        target: 98,
        baseline: 93,
        min: 0,
        max: 100,
        isQuality: false,
        unit: "%",
        getPercentage: (value, baseline) => ((value - baseline) / baseline * 100).toFixed(1)
    }
};

let metrics = {
    quality: 4.0,
    capacity: 37,
    delivery: 93
};

let switchStates = {
    amr: false,
    ar: false,
    kitting: false,
    assembly: false,
    mes: false,
    pick: false,
    line: false
};

// Initialisation immédiate de l'affichage avec les valeurs par défaut
updateDisplay();

async function fetchIndicators() {
    console.log('Fetching indicators...');
    try {
        const { data, error } = await supabase
            .from('indicators')
            .select('*');

        if (error) {
            console.error('Erreur lors de la récupération des indicateurs:', error);
            return;
        }

        console.log('Indicateurs récupérés:', data);
        if (data && data.length > 0) {
            metrics = {
                quality: data.find(d => d.type === 'quality')?.value ?? metrics.quality,
                capacity: data.find(d => d.type === 'capacity')?.value ?? metrics.capacity,
                delivery: data.find(d => d.type === 'delivery')?.value ?? metrics.delivery
            };
            console.log('Metrics updated:', metrics);
            updateDisplay();
        }
    } catch (err) {
        console.error('Erreur lors de la récupération des indicateurs:', err);
    }
}

async function fetchLevers() {
    console.log('Fetching levers...');
    try {
        const { data, error } = await supabase
            .from('levers')
            .select('*');

        if (error) {
            console.error('Erreur lors de la récupération des leviers:', error);
            return;
        }

        console.log('Leviers récupérés:', data);
        if (data && data.length > 0) {
            switchStates = data.reduce((acc, lever) => {
                acc[lever.name] = lever.is_active;
                return acc;
            }, {...switchStates});
            console.log('Switch states updated:', switchStates);
            updateDisplay();
        }
    } catch (err) {
        console.error('Erreur lors de la récupération des leviers:', err);
    }
}

function getProgressColor(current, target, baseline, isQuality = false) {
    let isTargetReached;

    if (isQuality) {
        isTargetReached = current <= target;
    } else {
        isTargetReached = current >= target;
    }

    return isTargetReached ? '#6EBE44' : '#005386';
}

function createProgressBar(key, config) {
    const value = metrics[key];
    let percentage;
    let targetPercentage;

    if (key === 'quality') {
        percentage = ((value - config.min) / (config.max - config.min)) * 100;
        targetPercentage = ((config.target - config.min) / (config.max - config.min)) * 100;
    } else {
        percentage = ((value - config.min) / (config.max - config.min)) * 100;
        targetPercentage = ((config.target - config.min) / (config.max - config.min)) * 100;
    }

    const isTargetReached = config.isQuality ? value <= config.target : value >= config.target;
    const progressColor = isTargetReached ? '#6EBE44' : '#005386';
    const targetColor = isTargetReached ? '#6EBE44' : '#ef4444';

    const totalImpact = getTotalImpact(key);
    const improvementPercentage = config.getPercentage(value, config.baseline);

    return `
        <div class="text-center">
            <div class="indicator-title">${config.title}</div>
            <div class="relative vertical-progress">
                <div class="vertical-fill" style="height: ${percentage}%; background-color: ${progressColor};">
                    <span class="text-white font-bold">${value}${config.unit}</span>
                </div>
                <div class="target-line" style="bottom: ${100 - targetPercentage}%"></div>
                <div class="target-label" style="bottom: ${100 - targetPercentage}%">Target: ${config.target}${config.unit}</div>
            </div>
            <div class="base-value">Base Value: ${config.baseline}${config.unit}</div>
            <div class="improvement-badge ${improvementPercentage < 0 ? 'negative' : 'positive'}">
                Improvement: ${improvementPercentage}%
            </div>
        </div>
    `;
}

function getTotalImpact(key) {
    return Object.keys(switchStates).reduce((acc, lever) => {
        if (switchStates[lever]) {
            acc += OPTIONS_IMPACT[lever][key];
        }
        return acc;
    }, 0);
}

function updateDisplay() {
    const indicatorsDiv = document.getElementById("indicators");
    if (indicatorsDiv) {
        indicatorsDiv.innerHTML = Object.keys(INDICATORS).map(key => createProgressBar(key, INDICATORS[key])).join('');
    }

    const leversDiv = document.getElementById("levers");
    if (leversDiv) {
        leversDiv.innerHTML = Object.keys(OPTIONS_IMPACT).map(lever => {
            const leverData = ACRONYM_DEFINITIONS[lever];
            return `
                <button class="lever-button" onclick="toggleLever('${lever}')">
                    <div class="text-xl font-semibold">${leverData}</div>
                    <div class="tooltip">${leverData}</div>
                </button>
            `;
        }).join('');
    }
}

window.toggleLever = function(lever) {
    switchStates[lever] = !switchStates[lever];
    updateDisplay();
};

// Initialisation
fetchIndicators();
fetchLevers();