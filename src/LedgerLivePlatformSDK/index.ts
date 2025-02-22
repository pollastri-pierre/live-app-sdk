import {
  JSONRPCServerAndClient,
  JSONRPCParams,
  JSONRPCServer,
  JSONRPCClient,
} from "json-rpc-2.0";
import DeviceBridge from "../deviceBridge";
import Logger from "../logger";
import { RawAccount, RawSignedTransaction } from "../rawTypes";
import { deserializeAccount, serializeTransaction } from "../serializers";

import type {
  Account,
  ApplicationDetails,
  Currency,
  DeviceDetails,
  EcdsaSignature,
  EstimatedFees,
  ExchangePayload,
  ExchangeType,
  FeesLevel,
  Transaction,
  Transport,
} from "../types";
import type {
  ListCurrenciesParams,
  RequestAccountParams,
  SignTransactionParams,
} from "./params.types";

const defaultLogger = new Logger("LL-PlatformSDK");

export default class LedgerLivePlatformSDK {
  private transport: Transport;

  private logger: Logger;

  private serverAndClient?: JSONRPCServerAndClient;

  constructor(transport: Transport, logger: Logger = defaultLogger) {
    this.transport = transport;
    this.logger = logger;
  }

  /**
   * Wrapper to api request for logging
   */
  private async _request<T>(
    method: string,
    params?: JSONRPCParams
  ): Promise<T> {
    if (!this.serverAndClient) {
      this.logger.error(`not connected - ${method}`);
      throw new Error("Ledger Live API not connected");
    }

    this.logger.log(`request - ${method}`, params);
    try {
      const result = (await this.serverAndClient.request(method, params)) as T;
      this.logger.log(`response - ${method}`, params);
      return result;
    } catch (error) {
      this.logger.warn(`error - ${method}`, params);
      throw error;
    }
  }

  /**
   * Connect the SDK to the Ledger Live instance
   */
  connect(): void {
    const serverAndClient = new JSONRPCServerAndClient(
      new JSONRPCServer(),
      new JSONRPCClient((payload) => this.transport.send(payload))
    );

    this.transport.onMessage = (payload) =>
      serverAndClient.receiveAndSend(payload);
    this.transport.connect();
    this.serverAndClient = serverAndClient;
    this.logger.log("connected", this.transport);
  }

  /**
   * Disconnect the SDK
   */
  disconnect(): void {
    delete this.serverAndClient;
    this.transport.disconnect();
    this.logger.log("disconnected", this.transport);
  }

  /**
   * Open a bridge to an application to exchange APDUs with a device application
   * @param {string} appName The name of the application to bridge
   * @param {<Result>(DeviceBridge) => Promise<Result>} handler A function using the bridge to send command to a device
   *
   * @returns {Promise<Result>} The result of the handler function
   */
  async bridgeApp<Result>(
    _appName: string,
    _handler: <Result>(deviceBridge: DeviceBridge) => Promise<Result>
  ): Promise<Result> {
    throw new Error("Function is not implemented yet");
  }

  /**
   * Open a bridge to a the device dashboard to exchange APDUs
   * @param {<Result>(DeviceBridge) => Promise<Result>} handler A function using the bridge to send command to a device
   *
   * @returns {Promise<Result>} The result of the handler function
   */
  async bridgeDashboard<Result>(
    _handler: <Result>(deviceBridge: DeviceBridge) => Promise<Result>
  ): Promise<Result> {
    throw new Error("Function is not implemented yet");
  }

  /**
   * Start the exchange process by generating a nonce on Ledger device
   * @param {ExchangeType} exchangeType
   * @param {string} partnerName
   *
   * @returns {Promise<string>} The nonce of the exchange
   */
  async initExchange(
    _exchangeType: ExchangeType,
    _partnerName: string
  ): Promise<string> {
    throw new Error("Function is not implemented yet");
  }

  /**
   * Complete an exchange process by passing by the exchange content and its signature.
   * @param {ExchangePayload} exchangePayload
   * @param {EcdsaSignature} payloadSignature
   * @param {FeesLevel} txFeesLevel
   */
  async completeExchange(
    _exchangePayload: ExchangePayload,
    _payloadSignature: EcdsaSignature,
    _txFeesLevel: FeesLevel
  ): Promise<void> {
    throw new Error("Function is not implemented yet");
  }

  /**
   * Let user sign a transaction through Ledger Live
   * @param {string} accountId - LL id of the account
   * @param {Transaction} transaction  - the transaction in the currency family-specific format
   * @param {SignTransactionParams} params - parameters for the sign modal
   *
   * @returns {Promise<RawSignedTransaction>} - the raw signed transaction to broadcast
   */
  async signTransaction(
    accountId: string,
    transaction: Transaction,
    params?: SignTransactionParams
  ): Promise<RawSignedTransaction> {
    return this._request<RawSignedTransaction>("transaction.sign", {
      accountId,
      transaction: serializeTransaction(transaction),
      params: params || {},
    });
  }

  /**
   * Broadcast a signed transaction through Ledger Live, providing an optimistic Operation given by signTransaction
   * @param {string} accountId - LL id of the account
   * @param {RawSignedTransaction} signedTransaction - a raw signed transaction returned by LL when signing
   *
   * @returns {Promise<string>} - hash of the transaction
   */
  async broadcastSignedTransaction(
    accountId: string,
    signedTransaction: RawSignedTransaction
  ): Promise<string> {
    return this._request("transaction.broadcast", {
      accountId,
      signedTransaction,
    });
  }

  /**
   * Estimate fees required to successfully broadcast a transaction.
   * @param {string} accountId - LL id of the account
   * @param {Transaction} transaction - the transaction to estimate
   *
   * @returns {Promise<EstimatedFees>} - Estimated fees for 3 level of confirmation speed
   */
  async estimateTransactionFees(
    _accountId: string,
    _transaction: Transaction
  ): Promise<EstimatedFees> {
    throw new Error("Function is not implemented yet");
  }

  /**
   * List accounts added by user on Ledger Live
   *
   * @returns {Account[]}
   */
  async listAccounts(): Promise<Account[]> {
    const rawAccounts = await this._request<RawAccount[]>("account.list");

    return rawAccounts.map(deserializeAccount);
  }

  /**
   * Let user choose an account in a Ledger Live, providing filters for choosing currency or allowing add account.
   *
   * @param {RequestAccountParams} params - parameters for the request modal
   * @returns {Promise<Account>}
   */
  async requestAccount(params: RequestAccountParams): Promise<Account> {
    const rawAccount = await this._request<RawAccount>(
      "account.request",
      params
    );

    return deserializeAccount(rawAccount);
  }

  /**
   * Let user verify it's account address on his device through Ledger Live
   *
   * @param {string} accountId - LL id of the account
   * @returns {Promise<string>} - the verified address
   */
  async receive(accountId: string): Promise<string> {
    return this._request("account.receive", { accountId });
  }

  /**
   * Synchronize an account with its network and return an updated view of the account
   * @param {string} accountId The id of the account to synchronize
   *
   * @returns {Promise<Account>} An updated view of the account
   */
  async synchronizeAccount(_accountId: string): Promise<Account> {
    throw new Error("Function is not implemented yet");
  }

  /**
   * List crypto-currencies supported by Ledger Live, providing filters by name or ticker
   *
   * @param {ListCurrenciesParams} params - filters for currencies
   * @returns {Promise<Currency[]>}
   */
  async listCurrencies(params?: ListCurrenciesParams): Promise<Currency[]> {
    return this._request("currency.list", params || {});
  }

  /**
   * Get information about a currently connected device (firmware version...)
   *
   * @returns {Promise<DeviceDetails>} Informations about a currently connected device
   */
  async getDeviceInfo(): Promise<DeviceDetails> {
    throw new Error("Function is not implemented yet");
  }

  /**
   * List applications opened on a currently connected device
   *
   * @returns {Promise<ApplicationDetails[]>} The list of applications
   */
  async listApps(): Promise<ApplicationDetails[]> {
    throw new Error("Function is not implemented yet");
  }
}
