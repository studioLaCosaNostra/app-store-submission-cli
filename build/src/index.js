"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer = require("puppeteer");
const fs = require("fs");
const readline = require("readline");
const debug = require("debug");
const semver = require("semver");
const minimist = require("minimist");
const argv = minimist(process.argv.slice(2));
const log = debug('apple-app-store');
var Platform;
(function (Platform) {
    Platform["iOS"] = "iOS";
    Platform["tvOS"] = "tvOS";
})(Platform || (Platform = {}));
const clickSignInButton = async (frame) => {
    log('clickSignInButton');
    const element = await frame.waitForSelector('#stepEl > sign-in > #signin > .container > #sign-in:not(disabled)');
    await element.click();
};
const saveCookies = async (page) => {
    log('saveCookies');
    const cookies = await page.cookies();
    fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));
};
const loadCookies = async (page) => {
    log('loadCookies');
    if (!fs.existsSync('cookies.json')) {
        return;
    }
    const cookies = JSON.parse(fs.readFileSync('cookies.json').toString());
    for (let index = 0; index < cookies.length; index++) {
        const cookie = cookies[index];
        await page.setCookie(cookie);
    }
};
const openVerifyDeviceOptions = async (frame) => {
    log('openVerifyDeviceOptions');
    const selector = '#no-trstd-device-pop';
    await frame.waitForSelector(selector);
    await frame.click(selector);
};
const usePhoneTextCode = async (frame) => {
    log('usePhoneTextCode');
    const selector = '#use-phone-link';
    await frame.waitForSelector(selector);
    await frame.click(selector);
};
const clickTrustBrowser = async (frame) => {
    log('clickTrustBrowser');
    const selector = 'button.trust-browser';
    const element = await frame.waitForSelector(selector);
    await element.click();
};
const askForVerificationCode = () => {
    log('askForVerificationCode');
    const readlineInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => {
        readlineInterface.question('Please type your verification code: ', answer => {
            console.log(`Thank you for verification code: ${answer}`);
            readlineInterface.close();
            resolve(answer);
        });
    });
};
const authFrameSelector = '#aid-auth-widget-iFrame';
const isLoginForm = async (page) => {
    log('isLoginForm');
    return page.$(authFrameSelector);
};
const login = async (page, user, password) => {
    log('login');
    const frameElement = await page.$(authFrameSelector);
    if (!frameElement) {
        throw new Error(`Missing frame ${authFrameSelector}`);
    }
    const frame = await frameElement.contentFrame();
    if (!frame) {
        throw new Error(`Missing frame ${authFrameSelector}`);
    }
    const accountNameInputSelector = '#account_name_text_field';
    await frame.waitForSelector(accountNameInputSelector);
    await frame.focus(accountNameInputSelector);
    await page.keyboard.type(user);
    await clickSignInButton(frame);
    const passwordInputSelector = '#password_text_field';
    await frame.waitForSelector(passwordInputSelector);
    await frame.waitFor(2000);
    await frame.focus(passwordInputSelector);
    await page.keyboard.type(password);
    await clickSignInButton(frame);
    const verifyDeviceSelector = 'verify-device';
    await frame.waitForSelector(`${verifyDeviceSelector}`);
    const isVerifyDevice = await frame.$(verifyDeviceSelector);
    if (isVerifyDevice) {
        console.log('Verify device.');
        await openVerifyDeviceOptions(frame);
        await usePhoneTextCode(frame);
        const verificationCode = await askForVerificationCode();
        await page.keyboard.type(verificationCode);
        await clickTrustBrowser(frame);
    }
};
const homePageSelector = '#homepage-container';
const isHomePage = async (page) => {
    log('isHomePage');
    return page.$(homePageSelector);
};
const goToApps = async (page) => {
    log('goToApps');
    const xPath = '//div[text()="My Apps"]';
    const element = await page.waitForXPath(xPath);
    await page.waitFor(1500);
    await element.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#manage-your-apps-search');
};
const goToApp = async (page, appleId) => {
    log('goToApp');
    const selector = `a[href$='app\/${appleId}']`;
    const element = await page.waitForSelector(selector);
    await element.click();
    await page.waitForSelector('#appPageHeader');
};
const getPrepareSubmissionXPath = (option) => {
    const texts = {
        [Platform.iOS]: 'IOS APP',
        [Platform.tvOS]: 'TVOS APP',
    };
    const xPath = `//h3[text()='${texts[option]}']/following-sibling::ul//a[contains(text(), 'Prepare for Submission')]`;
    return xPath;
};
const isActiveSubmission = async (page, option) => {
    log('isActiveSubmission');
    await page.waitFor(1500);
    const isAvailableNewSubmission = await page.$x(getPrepareSubmissionXPath(option));
    return isAvailableNewSubmission.length > 0;
};
const selectVersionOrPlatform = async (page, option, version) => {
    log('selectVersionOrPlatform');
    const openPopUpSelector = 'a.newVersion_link';
    const openPopUpElement = await page.waitForSelector(openPopUpSelector);
    await openPopUpElement.click();
    await page.waitForSelector('#versionPopUp.open');
    const xPath = `//div[@id="versionPopUp"]//a[not(@class="ng-hide") and text()="${option}"]`;
    const optionElement = await page.waitForXPath(xPath);
    if (optionElement) {
        await optionElement.click();
        await page.waitForSelector('.ng-modal:not(.ng-hide)');
        const updateSemVerMinor = semver.inc(`${version}.0`, 'minor');
        if (!updateSemVerMinor) {
            throw new Error(`Something wrong with version ${version}`);
        }
        const comVer = updateSemVerMinor.replace(/\.0$/, '');
        await page.keyboard.type(comVer);
        const buttonElement = await page.waitForSelector('.modal-buttons .primary');
        await buttonElement.click();
        await page.waitForSelector('#appStorePageContent p.status.waiting');
    }
    else {
        throw new Error('Missing option');
    }
};
const openUserMenu = async (page) => {
    log('openUserMenu');
    const selector = '.mobile-user-avatar';
    const element = await page.waitForSelector(selector);
    await page.waitFor(3000);
    await element.click();
    await page.waitForSelector('#itc-user-menustate:checked');
};
const closeUserMenu = async (page) => {
    log('closeUserMenu');
    const selector = '.mobile-user-avatar';
    const element = await page.waitForSelector(selector);
    await element.click();
    await page.waitForSelector('#itc-user-menustate:not(:checked)');
};
const selectTeam = async (page, teamName) => {
    log('selectTeam');
    const xPath = `//label[contains(@class, 'custom-radio-check') and text() = '${teamName}']`;
    await openUserMenu(page);
    const element = await page.waitForXPath(xPath);
    const forAttribute = await page.evaluate(element => {
        return element.getAttribute('for');
    }, element);
    const isChecked = await page.evaluate(id => {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error('Missing select team input');
        }
        return element.getAttribute('checked') !== null;
    }, forAttribute);
    if (isChecked) {
        await closeUserMenu(page);
    }
    else {
        await element.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }
};
const goToReadyForSale = async (page, option) => {
    log('goToReadyForSale');
    if (option === 'iOS') {
        const selector = `a[href$='ios/versioninfo/deliverable']`;
        const element = await page.waitForSelector(selector);
        await page.waitFor(1500);
        await element.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }
    if (option === 'tvOS') {
        throw new Error('Not implemented');
    }
};
const getCurrentVersion = async (page, option) => {
    log('getCurrentVersion');
    await goToReadyForSale(page, option);
    const selector = `#appVerionInfoHeaderId h1`;
    await page.waitFor(2000);
    const element = await page.waitForSelector(selector);
    const text = await page.evaluate(element => element.textContent, element);
    const version = Number(text.replace(/^\D+/g, ''));
    return version;
};
const createNewSubmission = async (page, option) => {
    log('createNewSubmission');
    const version = await getCurrentVersion(page, option);
    await selectVersionOrPlatform(page, option, version);
};
const goToPrepareSubmission = async (page, option) => {
    log('goToPrepareSubmission');
    const xPath = getPrepareSubmissionXPath(option);
    const element = await page.waitForXPath(xPath);
    await element.click();
    await page.waitForSelector('#appStorePageContent p.status.waiting');
};
const typeVersionInformation = async (page, text) => {
    log(`typeVersionInformation: START\n${text}\nEND`);
    const xPath = `//label[contains(text(), "What's New in This Version")]/following-sibling::span//span//textarea`;
    const element = await page.waitForXPath(xPath);
    await page.evaluate(element => {
        element.value = '';
    }, element);
    await element.focus();
    await page.keyboard.type(text);
};
const typePromotionalText = async (page, text = '') => {
    log(`typePromotionalText: START\n${text}\nEND`);
    const xPath = `//label[contains(text(), "Promotional Text")]/following-sibling::span//span//textarea`;
    const element = await page.waitForXPath(xPath);
    await page.evaluate(element => {
        element.value = '';
    }, element);
    await element.focus();
    await page.keyboard.type(text);
};
const selectBuild = async (page, buildVersion) => {
    log('selectBuild');
    const deleteIconSelector = 'td a.deleteIcon';
    const deleteIconElement = await page.$(deleteIconSelector);
    if (deleteIconElement) {
        await deleteIconElement.click();
    }
    const addButtonXPath = `//h1[contains(text(), "Build")]//a[contains(@class, "addIcon")]`;
    const addButtonElement = await page.waitForXPath(addButtonXPath);
    await addButtonElement.click();
    const buildOnListXPath = `//div[contains(@class, "buildModalList")]//tr[td//text()[contains(., "${buildVersion}")]]`;
    const buildOnListElement = await page.waitForXPath(buildOnListXPath);
    const buildCheckboxElement = await buildOnListElement.$('a.radiostyle');
    if (!buildCheckboxElement) {
        throw new Error('Missing build version checkbox');
    }
    await buildCheckboxElement.click();
    await page.waitForSelector('div.buildModalList a.radiostyle.checked');
    const buttonElement = await page.waitForSelector('.modal-buttons .primary');
    await buttonElement.click();
};
const saveChanges = async (page) => {
    log('saveChanges');
    const xPath = '//div[contains(@class, "pane-layout-content-header-buttons")]//button[span[contains(text(), "Save")]]';
    const element = await page.waitForXPath(xPath);
    await element.click();
};
const submitForReview = async (page) => {
    log('submitForReview');
    const xPath = '//div[contains(@class, "pane-layout-content-header-buttons")]//button[contains(text(), "Submit for Review")]';
    const element = await page.waitForXPath(xPath);
    await element.click();
};
const main = async () => {
    const accountName = argv.login || argv.l;
    if (!accountName) {
        throw new Error('Missing argument --login | -l');
    }
    const password = argv.password || argv.p;
    if (!password) {
        throw new Error('Missing argument --password | -p');
    }
    const appAppleId = argv.appleId || argv.id;
    if (!appAppleId) {
        throw new Error('Missing argument --appleId | --id');
    }
    const versionInformation = argv.versionInformation || argv.v;
    if (!versionInformation) {
        throw new Error('Missing argument --versionInformation | -v');
    }
    const buildVersion = argv.buildVersion || argv.b;
    if (!buildVersion) {
        throw new Error('Missing argument --buildVersion | -b');
    }
    const browser = await puppeteer.launch({
        headless: !(argv.headless === 'false' || argv.h === 'false'),
    });
    log('newPage');
    const page = await browser.newPage();
    loadCookies(page);
    const url = 'https://appstoreconnect.apple.com/';
    log(`go to ${url}`);
    await page.goto(url);
    await page.waitForSelector(`${authFrameSelector}, ${homePageSelector}`);
    if (await isLoginForm(page)) {
        await login(page, accountName, password);
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        await page.waitForSelector(homePageSelector);
    }
    if (await isHomePage(page)) {
        await goToApps(page);
        const teamName = argv.teamName || argv.t;
        if (teamName) {
            await selectTeam(page, teamName);
        }
        await goToApp(page, appAppleId);
        const isSubmission = await isActiveSubmission(page, Platform.iOS);
        if (isSubmission === false) {
            await createNewSubmission(page, Platform.iOS);
        }
        await goToPrepareSubmission(page, Platform.iOS);
        await typeVersionInformation(page, versionInformation);
        const promotionalText = argv.promotionalText || argv.r;
        await typePromotionalText(page, promotionalText);
        await selectBuild(page, buildVersion);
        await saveChanges(page);
        // await submitForReview(page);
    }
    await saveCookies(page);
    log('close');
    await browser.close();
};
main().catch(error => console.error(error));
//# sourceMappingURL=index.js.map