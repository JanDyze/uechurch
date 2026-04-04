import { db } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

const FINANCE_COLLECTION = "finances";

// Helper to normalize transaction data
const normalizeTransaction = (data, docId) => {
  return {
    id: docId,
    firestoreId: docId,
    date: data.date || new Date().toISOString().split('T')[0],
    description: data.description || '',
    category: data.category || 'General',
    amount: data.amount || 0,
    type: data.type || (data.amount >= 0 ? 'income' : 'expense'),
    status: data.status || 'completed',
    payerPayee: data.payerPayee || '',
    notes: data.notes || '',
    createdAt: data.createdAt || new Date().toISOString(),
  };
};

// Subscribe to transactions changes
export const subscribeToTransactions = (callback) => {
  const financeRef = collection(db, FINANCE_COLLECTION);
  const q = query(financeRef, orderBy("date", "desc"));
  
  return onSnapshot(
    q,
    (snapshot) => {
      const transactions = snapshot.docs.map((doc) => {
        return normalizeTransaction(doc.data(), doc.id);
      });
      callback(transactions);
    },
    (error) => {
      console.error("Error subscribing to finances:", error);
      callback([]);
    }
  );
};

// Add a new transaction
export const addTransaction = async (transactionData) => {
  try {
    const financeRef = collection(db, FINANCE_COLLECTION);
    const docRef = await addDoc(financeRef, {
      ...transactionData,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding transaction:", error);
    throw error;
  }
};

// Update a transaction
export const updateTransaction = async (firestoreId, transactionData) => {
  try {
    const transactionRef = doc(db, FINANCE_COLLECTION, firestoreId);
    const { firestoreId: _, id: __, ...dataToUpdate } = transactionData;
    await updateDoc(transactionRef, dataToUpdate);
  } catch (error) {
    console.error("Error updating transaction:", error);
    throw error;
  }
};

// Delete a transaction
export const deleteTransaction = async (firestoreId) => {
  try {
    const transactionRef = doc(db, FINANCE_COLLECTION, firestoreId);
    await deleteDoc(transactionRef);
  } catch (error) {
    console.error("Error deleting transaction:", error);
    throw error;
  }
};
