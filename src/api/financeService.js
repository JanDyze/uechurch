import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import {
  ACCOUNT_KEYS,
  BANK_ACCOUNT,
  CASH_ACCOUNT,
  mapLegacyCategory,
} from "../data/financeChart";

const FINANCE_COLLECTION = "finances";
const SETTINGS_COLLECTION = "financeSettings";
const OPENING_DOC = "opening";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const safeAccount = (value, fallback = CASH_ACCOUNT) =>
  ACCOUNT_KEYS.includes(value) ? value : fallback;

/**
 * A transaction is one line of the church ledger:
 *   inflow   - money received into `account`
 *   outflow  - money paid out of `account`
 *   transfer - money moved from `account` to `toAccount` (Eastwest deposit or
 *              withdrawal). Transfers never touch income or expense totals.
 * `amount` is always stored positive; `direction` carries the sign.
 *
 * Documents written before the statement rewrite used `type: income|expense`
 * and free-text categories, so those are mapped onto the chart of accounts here
 * rather than migrated in the database.
 */
const normalizeTransaction = (data, docId) => {
  const legacy = !data.direction;
  const direction = legacy
    ? data.type === "expense"
      ? "outflow"
      : "inflow"
    : data.direction;

  const mapped = legacy ? mapLegacyCategory(data.category, direction) : null;
  const account = safeAccount(data.account);

  return {
    id: docId,
    firestoreId: docId,
    date: data.date || new Date().toISOString().split("T")[0],
    description: data.description || "",
    direction,
    category: mapped ? mapped.category : data.category || "",
    subcategory: mapped ? mapped.subcategory || "" : data.subcategory || "",
    account,
    // Deposits move cash to the bank; withdrawals move it back to the hand.
    toAccount:
      direction === "transfer"
        ? safeAccount(data.toAccount, account === BANK_ACCOUNT ? CASH_ACCOUNT : BANK_ACCOUNT)
        : "",
    amount: Math.abs(toNumber(data.amount)),
    payerPayee: data.payerPayee || "",
    notes: data.notes || "",
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || "",
  };
};

export const subscribeToTransactions = (callback) => {
  const financeRef = collection(db, FINANCE_COLLECTION);

  return onSnapshot(
    financeRef,
    (snapshot) => {
      const transactions = snapshot.docs.map((d) => normalizeTransaction(d.data(), d.id));
      // Newest first; ties broken by entry order so same-day rows stay stable.
      transactions.sort(
        (a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || "")
      );
      callback(transactions);
    },
    (error) => {
      console.error("Error subscribing to finances:", error);
      callback([]);
    }
  );
};

export const addTransaction = async (transactionData) => {
  try {
    const financeRef = collection(db, FINANCE_COLLECTION);
    const docRef = await addDoc(financeRef, {
      ...transactionData,
      amount: Math.abs(toNumber(transactionData.amount)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding transaction:", error);
    throw error;
  }
};

export const updateTransaction = async (firestoreId, transactionData) => {
  try {
    const transactionRef = doc(db, FINANCE_COLLECTION, firestoreId);
    const { firestoreId: _, id: __, createdAt: ___, ...dataToUpdate } = transactionData;
    await updateDoc(transactionRef, {
      ...dataToUpdate,
      amount: Math.abs(toNumber(dataToUpdate.amount)),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    throw error;
  }
};

export const deleteTransaction = async (firestoreId) => {
  try {
    const transactionRef = doc(db, FINANCE_COLLECTION, firestoreId);
    await deleteDoc(transactionRef);
  } catch (error) {
    console.error("Error deleting transaction:", error);
    throw error;
  }
};

/**
 * The single starting point of the ledger: what each account held at the start
 * of `asOf`. Every later month's beginning balance is rolled forward from here,
 * so it only ever has to be entered once.
 */
const normalizeOpeningBalance = (data) => ({
  asOf: data?.asOf || `${new Date().getFullYear()}-01-01`,
  cashOnHand: toNumber(data?.cashOnHand),
  bankEastwest: toNumber(data?.bankEastwest),
  isSet: Boolean(data?.asOf),
});

export const subscribeToOpeningBalance = (callback) => {
  const openingRef = doc(db, SETTINGS_COLLECTION, OPENING_DOC);

  return onSnapshot(
    openingRef,
    (snapshot) => callback(normalizeOpeningBalance(snapshot.exists() ? snapshot.data() : null)),
    (error) => {
      console.error("Error subscribing to opening balance:", error);
      callback(normalizeOpeningBalance(null));
    }
  );
};

export const saveOpeningBalance = async ({ asOf, cashOnHand, bankEastwest }) => {
  try {
    const openingRef = doc(db, SETTINGS_COLLECTION, OPENING_DOC);
    await setDoc(
      openingRef,
      {
        asOf,
        cashOnHand: toNumber(cashOnHand),
        bankEastwest: toNumber(bankEastwest),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error saving opening balance:", error);
    throw error;
  }
};
