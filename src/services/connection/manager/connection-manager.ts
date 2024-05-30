/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ClientModel } from "../models/client/client-model";
import { ConsoleColors } from "../models/console-colors/console-colors";
import { ConnectionServer } from "../server/connection-server";
import { ConnectionUtils } from "../utils/connection-utils";
import { Publisher } from "../interfaces/publisher/publisher-interface";
import { Subscriber } from "../interfaces/subscriber/subscriber-interface";
import { MessageInterface } from "../interfaces/message/message-interface";

export default class ConnectionManager implements Publisher {
  //* Singleton
  private static _instance: ConnectionManager | null = null;
  public static get instance(): ConnectionManager {
    if (!ConnectionManager._instance) {
      ConnectionManager._instance = new ConnectionManager();
    }
    return ConnectionManager._instance;
  }
  //* **********

  private _subscribersList: Subscriber[] = [];
  private _clientsConnectedList: ClientModel[] = [];
  private _clientsConnectedCount = 0;

  private _webSocketServer: any;
  private _ipAddress: string | null = null;
  private _port: number | null = null;

  public getIpAddress(): string | null {
    if (this._ipAddress == null) {
      this._ipAddress = ConnectionUtils.findIpAddress();
    }

    return this._ipAddress;
  }

  public async getPort(): Promise<number | null> {
    if (this._port == null) {
      this._port = await ConnectionUtils.findAvailablePort(43133, 65535);
    }

    return this._port;
  }

  public async startServer(): Promise<void> {
    if (this._webSocketServer) {
      ConnectionServer.closeServer(this._webSocketServer);
    }

    const host = this.getIpAddress();
    const port = await this.getPort();

    this._webSocketServer = await ConnectionServer.startServer(host!, port!);

    this._setConnectionHandlers();

    ConnectionUtils.consoleLogWithColor(
      `Servidor iniciado en ${host}:${port}.`,
      ConsoleColors.Yellow
    );
  }

  private _setConnectionHandlers() {
    this._webSocketServer.on("connection", (ws: any) => {
      this._onClientConnectedHandler(ws);

      ws.on("message", (message: any) => {
        this._onClientMessageHandler(message);
      });

      ws.on("close", () => {
        this._onClientDisconnectedHandler(ws);
      });
    });
  }

  public sendMessage(client: ClientModel, message: any) {
    const messageJson = JSON.stringify(message);

    ConnectionServer.sendMessage(client.ws, messageJson);
  }

  public closeServer(): void {
    if (!this._webSocketServer) {
      ConnectionUtils.consoleLogWithColor(
        "Se intento cerrar el servidor pero ya estaba cerrado.",
        ConsoleColors.Red
      );

      return;
    }

    ConnectionServer.closeServer(this._webSocketServer);

    this._clientsConnectedCount = 0;
    this._clientsConnectedList = [];
    this._webSocketServer = null;

    ConnectionUtils.consoleLogWithColor(
      "Servidor cerrado.",
      ConsoleColors.Yellow
    );
  }

  private _onClientConnectedHandler(ws: any): void {
    this._clientsConnectedCount++;

    const newClient: ClientModel = new ClientModel(
      this._clientsConnectedCount,
      ws
    );

    this._addClientToList(newClient);

    ConnectionUtils.consoleLogWithColor(
      `Cliente id: ${newClient.id} conectado.`,
      ConsoleColors.Green
    );
  }

  private _onClientMessageHandler(message: any): void {
    const messageJson: MessageInterface = JSON.parse(
      message
    ) as MessageInterface;

    this.notifySubscribers(messageJson);

    ConnectionUtils.consoleLogWithColor(
      `LLego mensaje del tipo ${messageJson.type}`,
      ConsoleColors.Cyan
    );
  }

  private _onClientDisconnectedHandler(ws: any): void {
    if (this._clientsConnectedList.length == 0) {
      return;
    }

    const clientId = this._removeClientFromList(ws);

    if (clientId === -1) {
      ConnectionUtils.consoleLogWithColor(
        `Error en onClientDisconnectedHandler: el cliente no fue encontrado.`,
        ConsoleColors.Red
      );

      return;
    }

    ConnectionUtils.consoleLogWithColor(
      `Cliente id: ${clientId} desconectado.`,
      ConsoleColors.Magenta
    );
  }

  private _addClientToList(newClient: ClientModel): void {
    this._clientsConnectedList.push(newClient);
  }

  private _removeClientFromList(ws: any): number {
    const index = this._clientsConnectedList.findIndex(
      (client) => client.ws === ws
    );

    if (index !== -1) {
      const clientId = this._clientsConnectedList[index].id;

      this._clientsConnectedList.splice(index, 1);

      return clientId;
    }

    return -1;
  }

  addSubscriber(subscriber: Subscriber): void {
    this._subscribersList.push(subscriber);
  }

  removeSubscriber(subscriber: Subscriber): void {
    const index: number = this._subscribersList.findIndex(
      (item) => item == subscriber
    );

    if (index !== -1) {
      this._subscribersList.splice(index, 1);
    }
  }

  notifySubscribers(data: MessageInterface): void {
    this._subscribersList.forEach((subscriber) => subscriber.update(data));
  }
}
