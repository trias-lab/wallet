import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Events, NavController, NavParams } from 'ionic-angular';
import * as _ from 'lodash';

// Providers
import { Observable } from 'rxjs/Observable';
import { ActionSheetProvider } from '../../providers/action-sheet/action-sheet';
import { AddressBookProvider } from '../../providers/address-book/address-book';
import { AddressProvider } from '../../providers/address/address';
import { AppProvider } from '../../providers/app/app';
import { ExternalLinkProvider } from '../../providers/external-link/external-link';
import { IncomingDataProvider } from '../../providers/incoming-data/incoming-data';
import { Logger } from '../../providers/logger/logger';
import { PopupProvider } from '../../providers/popup/popup';
import { ProfileProvider } from '../../providers/profile/profile';
import { Coin, WalletProvider } from '../../providers/wallet/wallet';

// pages
import { ReceivePage } from '../receive/receive';
import { WalletTabsChild } from '../wallet-tabs/wallet-tabs-child';
import { WalletTabsProvider } from '../wallet-tabs/wallet-tabs.provider';
import { AmountPage } from './amount/amount';

export interface FlatWallet {
  color: string;
  name: string;
  recipientType: 'wallet';
  coin: Coin;
  network: 'testnet' | 'mainnet';
  m: number;
  n: number;
  needsBackup: boolean;
  isComplete: () => boolean;
  getAddress: () => Promise<string>;
}

@Component({
  selector: 'page-send',
  templateUrl: 'send.html'
})
export class SendPage extends WalletTabsChild {
  public search: string = '';
  public walletsBtc;
  public walletsBch;
  public walletsEth;
  public walletsTri;
  public walletBchList: FlatWallet[];
  public walletBtcList: FlatWallet[];
  public walletEthList: FlatWallet[];
  public walletTriList: FlatWallet[];
  public contactsList = [];
  public filteredContactsList = [];
  public filteredWallets = [];
  public hasBtcWallets: boolean;
  public hasBchWallets: boolean;
  public hasEthWallets: boolean;
  public hasTriWallets: boolean;
  public hasContacts: boolean;
  public contactsShowMore: boolean;
  public amount: string;
  public fiatAmount: number;
  public fiatCode: string;
  public invalidAddress: boolean;

  public contactList: boolean = false;

  private CONTACTS_SHOW_LIMIT: number = 10;
  private currentContactsPage: number = 0;
  private scannerOpened: boolean;
  private validDataTypeMap: string[] = [
    'BitcoinAddress',
    'BitcoinCashAddress',
    'BitcoinUri',
    'BitcoinCashUri'
  ];

  private address;

  constructor(
    navCtrl: NavController,
    private navParams: NavParams,
    profileProvider: ProfileProvider,
    private walletProvider: WalletProvider,
    private addressBookProvider: AddressBookProvider,
    private logger: Logger,
    private incomingDataProvider: IncomingDataProvider,
    private popupProvider: PopupProvider,
    private addressProvider: AddressProvider,
    private events: Events,
    walletTabsProvider: WalletTabsProvider,
    private actionSheetProvider: ActionSheetProvider,
    private externalLinkProvider: ExternalLinkProvider,
    private appProvider: AppProvider,
    private translate: TranslateService
  ) {
    super(navCtrl, profileProvider, walletTabsProvider);

    this.address = this.navParams.get('address');
  }

  ionViewDidLoad() {
    this.logger.info('Loaded: SendPage');

    this.events.subscribe('update:address', data => {
      this.search = this.parseAddress(data.value);
      this.processInput();
    });
  }

  ionViewWillEnter() {
    this.walletsBtc = this.profileProvider.getWallets({ coin: 'btc' });
    this.walletsBch = this.profileProvider.getWallets({ coin: 'bch' });
    this.walletsEth = this.profileProvider.getWallets({ coin: 'eth' });
    this.walletsTri = this.profileProvider.getWallets({ coin: 'try' });
    this.hasBtcWallets = !_.isEmpty(this.walletsBtc);
    this.hasBchWallets = !_.isEmpty(this.walletsBch);
    this.hasEthWallets = !_.isEmpty(this.walletsEth);
    this.hasTriWallets = !_.isEmpty(this.walletsTri);
    this.walletBchList = this.getBchWalletsList();
    this.walletBtcList = this.getBtcWalletsList();
    this.walletEthList = this.getEthWalletsList();
    this.walletTriList = this.getTriWalletsList();
    this.updateContactsList();
  }

  ngOnDestroy() {
    this.events.unsubscribe('update:address');
  }

  private parseAddress(address: string): string {
    return address.replace(
      /^(bitcoincash:|bchtest:|bitcoin:|bitcoreEth:|bitcoreTry:)/i,
      ''
    );
  }

  private getBchWalletsList(): FlatWallet[] {
    return this.hasBchWallets ? this.getRelevantWallets(this.walletsBch) : [];
  }

  private getBtcWalletsList(): FlatWallet[] {
    return this.hasBtcWallets ? this.getRelevantWallets(this.walletsBtc) : [];
  }
  private getEthWalletsList(): FlatWallet[] {
    return this.hasEthWallets ? this.getRelevantWallets(this.walletsEth) : [];
  }
  private getTriWalletsList(): FlatWallet[] {
    return this.hasTriWallets ? this.getRelevantWallets(this.walletsTri) : [];
  }
  private getRelevantWallets(rawWallets): FlatWallet[] {
    return rawWallets
      .map(wallet => this.flattenWallet(wallet))
      .filter(wallet => this.filterIrrelevantRecipients(wallet));
  }

  private updateContactsList(): void {
    this.addressBookProvider.list().then(ab => {
      this.hasContacts = !_.isEmpty(ab);
      if (!this.hasContacts) return;

      let contactsList = [];
      _.each(ab, (v, k: string) => {
        contactsList.push({
          name: _.isObject(v) ? v.name : v,
          address: k,
          network: this.addressProvider.getNetwork(k),
          email: _.isObject(v) ? v.email : null,
          recipientType: 'contact',
          coin: this.addressProvider.getCoin(k),
          getAddress: () => Promise.resolve(k)
        });
      });
      this.contactsList = contactsList.filter(c =>
        this.filterIrrelevantRecipients(c)
      );
      let shortContactsList = _.clone(
        this.contactsList.slice(
          0,
          (this.currentContactsPage + 1) * this.CONTACTS_SHOW_LIMIT
        )
      );
      this.filteredContactsList = _.clone(shortContactsList);
      this.contactsShowMore =
        this.contactsList.length > shortContactsList.length;
    });
  }

  private flattenWallet(wallet): FlatWallet {
    return {
      color: wallet.color,
      name: wallet.name,
      recipientType: 'wallet',
      coin: wallet.coin,
      network: wallet.network,
      m: wallet.credentials.m,
      n: wallet.credentials.n,
      isComplete: wallet.isComplete(),
      needsBackup: wallet.needsBackup,
      getAddress: () => this.walletProvider.getAddress(wallet, false)
    };
  }

  private filterIrrelevantRecipients(recipient: {
    coin: string;
    network: string;
  }): boolean {
    return this.wallet
      ? (this.wallet.coin === recipient.coin ||
          (this.wallet.coin === 'try' && recipient.coin === 'eth')) &&
          this.wallet.network === recipient.network
      : true;
  }

  public shouldShowZeroState() {
    return (
      this.wallet && this.wallet.status && !this.wallet.status.totalBalanceSat
    );
  }

  public async goToReceive() {
    // await this.walletTabsProvider.goToTabIndex(0);
    this.navCtrl.pop();
    this.navCtrl.push(ReceivePage, {
      walletId: this.wallet.credentials.walletId,
      address: this.address
    });
    const coinName =
      this.wallet.coin === Coin.BTC
        ? 'bitcoin'
        : this.wallet.coin === Coin.ETH
        ? 'ETH'
        : this.wallet.coin === Coin.TRY
        ? 'Try'
        : 'bitcoin cash';
    const infoSheet = this.actionSheetProvider.createInfoSheet(
      'receiving-bitcoin',
      { coinName }
    );
    await Observable.timer(250).toPromise();
    infoSheet.present();
  }

  public showMore(): void {
    this.currentContactsPage++;
    this.updateContactsList();
  }

  public openScanner(): void {
    this.scannerOpened = true;
    this.walletTabsProvider.setSendParams({
      amount: this.navParams.data.amount,
      coin: this.navParams.data.coin
    });
    this.walletTabsProvider.setFromPage({ fromSend: true });
    this.events.publish('ScanFromWallet');
  }

  private checkCoinAndNetwork(data, isPayPro?): boolean {
    let isValid;
    if (isPayPro) {
      isValid = this.addressProvider.checkCoinAndNetworkFromPayPro(
        this.wallet.coin,
        this.wallet.network,
        data
      );
    } else {
      isValid = this.addressProvider.checkCoinAndNetworkFromAddr(
        this.wallet.coin,
        this.wallet.network,
        data
      );
    }

    if (isValid) {
      this.invalidAddress = false;
      return true;
    } else {
      this.invalidAddress = true;
      let network = isPayPro
        ? data.network
        : this.addressProvider.getNetwork(data);
      if (this.wallet.coin === 'bch' && this.wallet.network === network) {
        const isLegacy = this.checkIfLegacy();
        isLegacy ? this.showLegacyAddrMessage() : this.showErrorMessage();
      } else {
        this.showErrorMessage();
      }
    }

    return false;
  }

  private redir() {
    this.incomingDataProvider.redir(this.search, {
      amount: this.navParams.data.amount,
      coin: this.navParams.data.coin
    });
    this.search = '';
  }

  private showErrorMessage() {
    const msg = this.translate.instant(
      'The wallet you are using does not match the network and/or the currency of the address provided'
    );
    const title = this.translate.instant('Error');
    const infoSheet = this.actionSheetProvider.createInfoSheet(
      'default-error',
      { msg, title }
    );
    infoSheet.present();
    infoSheet.onDidDismiss(() => {
      this.search = '';
    });
  }

  private showLegacyAddrMessage() {
    const appName = this.appProvider.info.nameCase;
    const infoSheet = this.actionSheetProvider.createInfoSheet(
      'legacy-address-info',
      { appName }
    );
    infoSheet.present();
    infoSheet.onDidDismiss(option => {
      if (option) {
        let url =
          'https://bitpay.github.io/address-translator?addr=' + this.search;
        this.externalLinkProvider.open(url);
      }
      this.search = '';
    });
  }

  public async processInput() {
    if (this.search && this.search.trim() != '') {
      this.searchWallets();
      this.searchContacts();

      if (
        this.filteredContactsList.length === 0 &&
        this.filteredWallets.length === 0
      ) {
        const parsedData = this.incomingDataProvider.parseData(this.search);
        if (parsedData && parsedData.type == 'PayPro') {
          const coin: string =
            this.search.indexOf('bitcoincash') === 0 ? Coin.BCH : Coin.BTC;
          this.incomingDataProvider
            .getPayProDetails(this.search)
            .then(payProDetails => {
              payProDetails.coin = coin;
              const isValid = this.checkCoinAndNetwork(payProDetails, true);
              if (isValid) this.redir();
            })
            .catch(err => {
              this.invalidAddress = true;
              this.logger.warn(err);
            });
        } else if (
          parsedData &&
          _.indexOf(this.validDataTypeMap, parsedData.type) != -1
        ) {
          const isValid = this.checkCoinAndNetwork(this.search);
          if (isValid) this.redir();
        } else if (
          (parsedData && parsedData.type == 'EthcoinAddress') ||
          parsedData.type == 'TricoinAddress'
        ) {
          this.redir();
        } else {
          this.invalidAddress = true;
        }
      } else {
        this.invalidAddress = false;
      }
    } else {
      this.updateContactsList();
      this.filteredWallets = [];
    }
  }

  private checkIfLegacy(): boolean {
    return (
      this.incomingDataProvider.isValidBitcoinCashLegacyAddress(this.search) ||
      this.incomingDataProvider.isValidBitcoinCashUriWithLegacyAddress(
        this.search
      )
    );
  }

  public searchWallets(): void {
    if (this.hasBchWallets && this.wallet.coin === 'bch') {
      this.filteredWallets = this.walletBchList.filter(wallet => {
        return _.includes(wallet.name.toLowerCase(), this.search.toLowerCase());
      });
    }
    if (this.hasBtcWallets && this.wallet.coin === 'btc') {
      this.filteredWallets = this.walletBtcList.filter(wallet => {
        return _.includes(wallet.name.toLowerCase(), this.search.toLowerCase());
      });
    }
    if (this.hasEthWallets && this.wallet.coin === 'eth') {
      this.filteredWallets = this.walletEthList.filter(wallet => {
        return _.includes(wallet.name.toLowerCase(), this.search.toLowerCase());
      });
    }
    if (this.hasTriWallets && this.wallet.coin === 'try') {
      this.filteredWallets = this.walletTriList.filter(wallet => {
        return _.includes(wallet.name.toLowerCase(), this.search.toLowerCase());
      });
    }
  }

  public searchContacts(): void {
    this.filteredContactsList = _.filter(this.contactsList, item => {
      let val = item.name;
      return _.includes(val.toLowerCase(), this.search.toLowerCase());
    });
  }

  public goToAmount(item): void {
    item
      .getAddress()
      .then((addr: string) => {
        if (!addr) {
          // Error is already formated
          this.popupProvider.ionicAlert('Error - no address');
          return;
        }
        this.logger.debug('Got address:' + addr + ' | ' + item.name);
        this.navCtrl.push(AmountPage, {
          recipientType: item.recipientType,
          amount: parseInt(this.navParams.data.amount, 10),
          toAddress: addr,
          name: item.name,
          email: item.email,
          color: item.color,
          coin: this.wallet.coin,
          network: item.network
        });
      })
      .catch(err => {
        this.logger.error('Send: could not getAddress', err);
      });
  }

  public closeCam(): void {
    if (this.scannerOpened) this.events.publish('ExitScan');
    else this.getParentTabs().dismiss();
    this.scannerOpened = false;
  }

  public showContactList(): void {
    this.contactList = !this.contactList;
  }
}
