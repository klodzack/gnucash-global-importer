export const SELECTOR = {
    ROOT: {
        SIGN_IN: 'a[data-identifier="sign-in"]',
    },
    SIGN_IN: {
        EMAIL: 'input[name="Email"]',
        PASSWORD: 'input[name="Password"]',
        SUBMIT: 'button[name="SignIn"]',
    },
    MFA: {
        START_BUTTON: 'input[id="ius-mfa-options-submit-btn"]',
        INPUT: 'input[id="ius-mfa-confirm-code"]',
        SUBMIT: 'input[id="ius-mfa-otp-submit-btn"]',
    },
    DASHBOARD: {
        NAV: {
            TRANSACTIONS: 'a[href="/transaction.event"]',
        },
        TRANSACTIONS: {
            MODAL_CLOSE: '[data-automation-id="ModalDialog"] button[aria-label="Close"]',
            ACCOUNT_NAV: {
                ALL_ACCOUNTS: 'div.transactionPage li[id="account-0"]',
                ANY_ACCOUNT: 'div.transactionPage li[id^="account-"]',
                ACCOUNT: (id: number) => `div.transactionPage li[id="account-${id}"] a`,
            },
            TRANSACTION_DETAILS: {
                ACCOUNT: `dl[id="txn-detail-details"] dd`,
                DOWNLOAD_CSV: 'a[id="transactionExport"]',
            },
        },
    },
};
