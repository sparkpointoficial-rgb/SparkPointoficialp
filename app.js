// =====================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// =====================
let provider;
let signer;
let userAddress;
let contract;
let userData = null;

// DOM-элементы
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletStatusEl = document.getElementById('walletStatus');
const walletAddressEl = document.getElementById('walletAddress');
const ethBalanceEl = document.getElementById('ethBalance');
const registrationSection = document.getElementById('registrationSection');
const dashboardSection = document.getElementById('dashboardSection');
const entryPriceEl = document.getElementById('entryPrice');
const referrerInput = document.getElementById('referrerInput');
const registerBtn = document.getElementById('registerBtn');
const registerStatusEl = document.getElementById('registerStatus');
const userLevelEl = document.getElementById('userLevel');
const internalBalanceEl = document.getElementById('internalBalance');
const totalDirectReferralsEl = document.getElementById('totalDirectReferrals');
const referralsInLevelEl = document.getElementById('referralsInLevel');
const referralLinkOutput = document.getElementById('referralLinkOutput');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const levelsList = document.getElementById('levelsList');
const notificationEl = document.getElementById('notification');

// =====================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================

// Показать временное уведомление
function showNotification(message, isError = false) {
    notificationEl.textContent = message;
    notificationEl.style.background = isError ? '#c53030' : '#2d3748';
    notificationEl.style.display = 'block';
    setTimeout(() => {
        notificationEl.style.display = 'none';
    }, 5000);
}

// Обновить баланс ETH
async function updateEthBalance() {
    if (!provider || !userAddress) return;
    try {
        const balance = await provider.getBalance(userAddress);
        ethBalanceEl.textContent = `Баланс ETH: ${ethers.utils.formatEther(balance).substring(0, 7)}`;
    } catch (err) {
        console.error('Ошибка при получении баланса ETH:', err);
    }
}

// Загрузить данные контракта (стоимость, уровни)
async function loadContractData() {
    try {
        // Получаем стоимость вступления
        const price = await contract.ENTRY_PRICE();
        entryPriceEl.textContent = ethers.utils.formatEther(price);

        // Загружаем пороги уровней (предположим, что есть 5 уровней)
        for (let i = 0; i < 5; i++) {
            try {
                const threshold = await contract.thresholds(i);
                const li = document.createElement('li');
                li.textContent = `Уровень ${i}: требуется ${threshold} рефералов`;
                levelsList.appendChild(li);
            } catch (err) {
                // Если уровня нет, прекращаем загрузку
                break;
            }
        }
    } catch (err) {
        console.error('Ошибка загрузки данных контракта:', err);
    }
}

// Проверить, зарегистрирован ли пользователь
async function checkUserRegistration() {
    if (!contract || !userAddress) return;
    try {
        // Получаем данные пользователя из mapping users
        const user = await contract.users(userAddress);
        if (user.exists) {
            // Пользователь зарегистрирован
            userData = {
                level: user.level.toString(),
                internalBalance: ethers.utils.formatEther(user.internalBalance),
                referralsInLevel: user.referralsInLevel.toString(),
                totalDirectReferrals: user.totalDirectReferrals.toString(),
                referrer: user.referrer
            };
            updateDashboardUI();
            registrationSection.style.display = 'none';
            dashboardSection.style.display = 'block';
        } else {
            // Пользователь НЕ зарегистрирован
            userData = null;
            registrationSection.style.display = 'block';
            dashboardSection.style.display = 'none';
        }
    } catch (err) {
        console.error('Ошибка проверки регистрации:', err);
        showNotification('Ошибка при проверке вашего статуса', true);
    }
}

// Обновить данные в личном кабинете
function updateDashboardUI() {
    if (!userData) return;
    userLevelEl.textContent = userData.level;
    internalBalanceEl.textContent = userData.internalBalance;
    referralsInLevelEl.textContent = userData.referralsInLevel;
    totalDirectReferralsEl.textContent = userData.totalDirectReferrals;
    // Формируем реферальную ссылку
    const baseUrl = window.location.origin + window.location.pathname;
    referralLinkOutput.value = `${baseUrl}?ref=${userAddress}`;
}

// =====================
// ОСНОВНЫЕ ФУНКЦИИ
// =====================

// 1. ПОДКЛЮЧЕНИЕ КОШЕЛЬКА
async function connectWallet() {
    if (!window.ethereum) {
        showNotification('Установите расширение MetaMask!', true);
        return;
    }
    try {
        showNotification('Подключение...');
        // Запрашиваем доступ к аккаунтам
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        // Создаем провайдер и подписанта
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        // Инициализируем контракт
        contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
        // Обновляем UI
        walletStatusEl.textContent = 'Статус: Подключен ✅';
        walletAddressEl.textContent = `Адрес: ${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
        connectWalletBtn.textContent = '✅ Кошелёк подключен';
        connectWalletBtn.disabled = true;
        connectWalletBtn.style.background = '#c6f6d5';
        connectWalletBtn.style.color = '#22543d';
        // Обновляем баланс и проверяем регистрацию
        await updateEthBalance();
        await loadContractData();
        await checkUserRegistration();
        showNotification('Кошелёк успешно подключен!');
        // Слушаем изменения счёта
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                // Пользователь отключился
                location.reload();
            } else {
                // Пользователь сменил аккаунт
                location.reload();
            }
        });
    } catch (err) {
        console.error('Ошибка подключения:', err);
        showNotification(`Ошибка подключения: ${err.message}`, true);
    }
}

// 2. РЕГИСТРАЦИЯ В ПРОЕКТЕ
async function registerInProject() {
    if (!contract || !userAddress) {
        showNotification('Сначала подключите кошелёк', true);
        return;
    }
    try {
        registerBtn.disabled = true;
        registerBtn.textContent = 'Транзакция отправляется...';
        registerStatusEl.textContent = '';
        // Получаем стоимость вступления
        const price = await contract.ENTRY_PRICE();
        const referrer = referrerInput.value.trim() || ethers.constants.AddressZero;
        // Вызываем функцию register (payable)
        const tx = await contract.register(referrer, {
            value: price,
            gasLimit: 200000 // Можно настроить
        });
        registerStatusEl.textContent = `Транзакция отправлена! Хэш: ${tx.hash.substring(0, 10)}...`;
        showNotification('Ожидание подтверждения сети...');
        // Ждем подтверждения
        const receipt = await tx.wait();
        registerStatusEl.textContent = `✅ Регистрация успешна!`;
        registerBtn.textContent = '💎 Вы зарегистрированы';
        showNotification('Поздравляем! Вы теперь участник проекта.');
        // Обновляем данные
        await checkUserRegistration();
        await updateEthBalance();
    } catch (err) {
        console.error('Ошибка регистрации:', err);
        let errorMsg = 'Ошибка при регистрации. ';
        if (err.code === 4001) {
            errorMsg += 'Вы отклонили транзакцию.';
        } else if (err.message.includes('insufficient funds')) {
            errorMsg += 'Недостаточно ETH на балансе.';
        } else {
            errorMsg += err.message.substring(0, 80);
        }
        registerStatusEl.textContent = errorMsg;
        showNotification(errorMsg, true);
        registerBtn.disabled = false;
        registerBtn.textContent = '💎 Оплатить и зарегистрироваться';
    }
}

// 3. КОПИРОВАНИЕ РЕФЕРАЛЬНОЙ ССЫЛКИ
function copyReferralLink() {
    if (!referralLinkOutput.value || referralLinkOutput.value === '') {
        showNotification('Сначала подключите кошелёк', true);
        return;
    }
    navigator.clipboard.writeText(referralLinkOutput.value).then(() => {
        const originalText = copyLinkBtn.textContent;
        copyLinkBtn.textContent = '✅ Скопировано!';
        showNotification('Ссылка скопирована в буфер обмена');
        setTimeout(() => {
            copyLinkBtn.textContent = originalText;
        }, 2000);
    });
}

// 4. ПРОВЕРКА РЕФЕРАЛЬНОГО КОДА В URL
function checkRefInUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const refAddress = urlParams.get('ref');
    if (ethers.utils.isAddress(refAddress)) {
        referrerInput.value = refAddress;
        showNotification('Реферальный код из ссылки автоматически подставлен!');
    }
}

// =====================
// ИНИЦИАЛИЗАЦИЯ
// =====================
// Назначаем обработчики событий
connectWalletBtn.addEventListener('click', connectWallet);
registerBtn.addEventListener('click', registerInProject);
copyLinkBtn.addEventListener('click', copyReferralLink);

// Проверяем, есть ли реферальный код в URL при загрузке страницы
window.addEventListener('load', checkRefInUrl);

// Слушаем изменения баланса
if (window.ethereum) {
    window.ethereum.on('chainChanged', () => location.reload());
    // Можно добавить периодическое обновление баланса
    setInterval(updateEthBalance, 15000);
                                                                                 }
