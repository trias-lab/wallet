import { Component, NgZone, ViewChild } from '@angular/core';
import { StatusBar } from '@ionic-native/status-bar';
import { TranslateService } from '@ngx-translate/core';
import * as echarts from 'echarts';
import {
  Events,
  ModalController,
  NavController,
  Platform
} from 'ionic-angular';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Observable, Subscription } from 'rxjs';

// Pages
import { AddPage } from '../add/add';
import { BitPayCardPage } from '../integrations/bitpay-card/bitpay-card';
import { BitPayCardIntroPage } from '../integrations/bitpay-card/bitpay-card-intro/bitpay-card-intro';
import { CoinbasePage } from '../integrations/coinbase/coinbase';
import { GlideraPage } from '../integrations/glidera/glidera';
import { ShapeshiftPage } from '../integrations/shapeshift/shapeshift';
import { PaperWalletPage } from '../paper-wallet/paper-wallet';
import { ScanPage } from '../scan/scan';
import { AmountPage } from '../send/amount/amount';
import { AddressbookAddPage } from '../settings/addressbook/add/add';
import { AddressbookPage } from '../settings/addressbook/addressbook';
import { TxDetailsPage } from '../tx-details/tx-details';
import { TxpDetailsPage } from '../txp-details/txp-details';
import { ActivityPage } from './activity/activity';
import { ProposalsPage } from './proposals/proposals';

// Providers
import { AddressBookProvider } from '../../providers/address-book/address-book';
import { AppProvider } from '../../providers/app/app';
import { BitPayCardProvider } from '../../providers/bitpay-card/bitpay-card';
import { BwcErrorProvider } from '../../providers/bwc-error/bwc-error';
import { ClipboardProvider } from '../../providers/clipboard/clipboard';
import { ConfigProvider } from '../../providers/config/config';
import { EmailNotificationsProvider } from '../../providers/email-notifications/email-notifications';
import { ExternalLinkProvider } from '../../providers/external-link/external-link';
import { FeedbackProvider } from '../../providers/feedback/feedback';
import { HomeIntegrationsProvider } from '../../providers/home-integrations/home-integrations';
import { IncomingDataProvider } from '../../providers/incoming-data/incoming-data';
import { Logger } from '../../providers/logger/logger';
import { OnGoingProcessProvider } from '../../providers/on-going-process/on-going-process';
import { PersistenceProvider } from '../../providers/persistence/persistence';
import { PlatformProvider } from '../../providers/platform/platform';
import { PopupProvider } from '../../providers/popup/popup';
import { ProfileProvider } from '../../providers/profile/profile';
import { ReleaseProvider } from '../../providers/release/release';
import { ReplaceParametersProvider } from '../../providers/replace-parameters/replace-parameters';
import { Coin, WalletProvider } from '../../providers/wallet/wallet';
import { SettingsPage } from '../settings/settings';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  @ViewChild('showCard')
  showCard;
  public wallets;
  public walletsBtc;
  public walletsBch;
  public cachedBalanceUpdateOn: string;
  public recentTransactionsEnabled: boolean;
  public txps;
  public txpsN: number;
  public notifications;
  public notificationsN: number;
  public serverMessage;
  public addressbook;
  public newRelease: boolean;
  public updateText: string;
  public homeIntegrations;
  public bitpayCardItems;
  public showBitPayCard: boolean = false;
  public showAnnouncement: boolean = false;
  public validDataFromClipboard;
  public payProDetailsData;
  public remainingTimeStr: string;
  public slideDown: boolean;

  public showRateCard: boolean;
  public homeTip: boolean;
  public showReorderBtc: boolean;
  public showReorderBch: boolean;
  public showIntegration;
  public totalBalance: number; // Total balance amount
  public balanceItem; // Each wallet's coin amount
  // public balanceName; // Each wallet's coin name
  public balanceLegend; // The legend attributes, like: name, color and percent
  public chartLegend; // The chart legend attributes
  public balanceChart; // The chart object
  public legendColors; // Chart's color pools
  public selectedLegendColors; // Chart's color pools
  public alternativeUnit;
  // public updatePercent;

  public hideHomeIntegrations: boolean;
  public showGiftCards: boolean;

  private isElectron: boolean;
  private updatingWalletId: object;
  private zone;
  private countDown;
  private onResumeSubscription: Subscription;
  private onPauseSubscription: Subscription;
  private latestVersion: string;

  constructor(
    private plt: Platform,
    private navCtrl: NavController,
    private profileProvider: ProfileProvider,
    private releaseProvider: ReleaseProvider,
    private walletProvider: WalletProvider,
    private bwcErrorProvider: BwcErrorProvider,
    private logger: Logger,
    private events: Events,
    private configProvider: ConfigProvider,
    private externalLinkProvider: ExternalLinkProvider,
    private onGoingProcessProvider: OnGoingProcessProvider,
    private popupProvider: PopupProvider,
    private modalCtrl: ModalController,
    private addressBookProvider: AddressBookProvider,
    private appProvider: AppProvider,
    private platformProvider: PlatformProvider,
    private homeIntegrationsProvider: HomeIntegrationsProvider,
    private persistenceProvider: PersistenceProvider,
    private feedbackProvider: FeedbackProvider,
    private bitPayCardProvider: BitPayCardProvider,
    private translate: TranslateService,
    private emailProvider: EmailNotificationsProvider,
    private replaceParametersProvider: ReplaceParametersProvider,
    private clipboardProvider: ClipboardProvider,
    private incomingDataProvider: IncomingDataProvider,
    private statusBar: StatusBar
  ) {
    this.slideDown = false;
    this.updatingWalletId = {};
    this.addressbook = {};
    this.cachedBalanceUpdateOn = '';
    this.isElectron = this.platformProvider.isElectron;
    this.showReorderBtc = false;
    this.showReorderBch = false;
    this.totalBalance = 0;
    this.balanceItem = [];
    // this.balanceName = [];
    this.legendColors = ['#25EAB2', '#AD40BB', '#11A9F9', '#8B4BF7'];
    this.selectedLegendColors = [];
    this.balanceLegend = [];
    this.chartLegend = [];
    this.alternativeUnit = '';
    // this.updatePercent = 0;
    this.zone = new NgZone({ enableLongStackTrace: false });
    this.events.subscribe('Home/reloadStatus', () => {
      this._willEnter();
      this._didEnter();
    });
  }

  ionViewWillEnter() {
    this._willEnter();
    if (this.plt.is('ios')) {
      this.statusBar.styleLightContent();
    }
  }

  ionViewDidEnter() {
    this._didEnter();
    // this.balanceLegend = [{ color: '#25EAB2', percent: 0, name: 'BTC' },
    // { color: '#AD40BB', percent: 0, name: 'BCH' }];
    const ec = echarts as any;
    let chart = ec.init(document.getElementById('chart'));
    this.balanceChart = chart;
    let optionchart = {
      color: [
        '#25EAB2', '#AD40BB'
      ],
      grid: {
        left: 15,
        top: 15,
        bottom: 10,
        right: 20
      },
      series: [
        {
          name: '访问来源',
          type: 'pie',
          radius: ['60%', '70%'],
          hoverAnimation: false,
          avoidLabelOverlap: false,
          label: {
            normal: {
              show: true,
              textStyle: {
                fontSize: '12',
                color: '#fff'
              }
            }
          },
          labelLine: {
            normal: {
              show: false
            }
          },
          data: [{ value: 10 }, { value: 20 }]
        }
      ]
    };
    this.balanceChart.setOption(optionchart);
  }
  private _willEnter() {
    // Show recent transactions card
    this.recentTransactionsEnabled = this.configProvider.get().recentTransactions.enabled;

    // Update list of wallets, status and TXPs
    this.setWallets();

    this.addressBookProvider
      .list()
      .then(ab => {
        this.addressbook = ab || {};
      })
      .catch(err => {
        this.logger.error(err);
      });

    // Update Tx Notifications
    this.getNotifications();

    // Update Wallet on Focus
    if (this.isElectron) {
      this.updateDesktopOnFocus();
    }
  }

  private _didEnter() {
    this.checkClipboard();
    this.subscribeIncomingDataMenuEvent();
    this.subscribeBwsEvents();

    // Show integrations
    const integrations = _.filter(this.homeIntegrationsProvider.get(), {
      show: true
    }).filter(i => i.name !== 'giftcards');

    this.showGiftCards = this.homeIntegrationsProvider.shouldShowInHome(
      'giftcards'
    );

    // Hide BitPay if linked
    setTimeout(() => {
      this.homeIntegrations = _.remove(_.clone(integrations), x => {
        if (x.name == 'debitcard' && x.linked) return;
        else return x;
      });
    }, 200);

    // Only BitPay Wallet
    this.bitPayCardProvider.get({}, (_, cards) => {
      this.zone.run(() => {
        this.showBitPayCard = this.appProvider.info._enabledExtensions.debitcard
          ? true
          : false;
        this.bitpayCardItems = cards;
      });
    });
  }

  ionViewDidLoad() {
    this.logger.info('Loaded: HomePage');

    if (this.isElectron) this.checkUpdate();
    this.checkHomeTip();
    this.checkFeedbackInfo();

    this.checkEmailLawCompliance();

    this.subscribeStatusEvents();

    this.subscribeLocalTxAction();

    this.onResumeSubscription = this.plt.resume.subscribe(() => {
      this.setWallets();
      this.checkClipboard();
      this.subscribeIncomingDataMenuEvent();
      this.subscribeBwsEvents();
      this.subscribeStatusEvents();
      this.subscribeLocalTxAction();
    });

    this.onPauseSubscription = this.plt.pause.subscribe(() => {
      this.events.unsubscribe('finishIncomingDataMenuEvent');
      this.events.unsubscribe('bwsEvent');
      this.events.unsubscribe('status:updated');
      this.events.unsubscribe('Local/TxAction');
    });
  }

  ngOnDestroy() {
    this.onResumeSubscription.unsubscribe();
    this.onPauseSubscription.unsubscribe();
  }

  ionViewWillLeave() {
    if (this.plt.is('ios')) {
      this.statusBar.styleDefault();
    }
    this.events.unsubscribe('finishIncomingDataMenuEvent');
    this.events.unsubscribe('bwsEvent');
    this.resetValuesForAnimationCard();
  }

  private async resetValuesForAnimationCard() {
    await Observable.timer(50).toPromise();
    this.validDataFromClipboard = null;
    this.slideDown = false;
  }

  private subscribeBwsEvents() {
    // BWS Events: Update Status per Wallet -> Update recent transactions and txps
    // NewBlock, NewCopayer, NewAddress, NewTxProposal, TxProposalAcceptedBy, TxProposalRejectedBy, txProposalFinallyRejected,
    // txProposalFinallyAccepted, TxProposalRemoved, NewIncomingTx, NewOutgoingTx
    this.events.subscribe('bwsEvent', (walletId: string) => {
      this.updateWallet(walletId);
    });
  }

  private subscribeStatusEvents() {
    // Create, Join, Import and Delete -> Get Wallets -> Update Status for All Wallets -> Update recent transactions and txps
    this.events.subscribe('status:updated', () => {
      this.setWallets();
    });
  }

  private subscribeLocalTxAction() {
    // Reject, Remove, OnlyPublish and SignAndBroadcast -> Update Status per Wallet -> Update recent transactions and txps
    this.events.subscribe('Local/TxAction', walletId => {
      this.updateWallet(walletId);
    });
  }

  private subscribeIncomingDataMenuEvent() {
    this.events.subscribe('finishIncomingDataMenuEvent', data => {
      switch (data.redirTo) {
        case 'AmountPage':
          this.sendPaymentToAddress(data.value, data.coin);
          break;
        case 'AddressBookPage':
          this.addToAddressBook(data.value);
          break;
        case 'OpenExternalLink':
          this.goToUrl(data.value);
          break;
        case 'PaperWalletPage':
          this.scanPaperWallet(data.value);
          break;
      }
    });
  }

  private goToUrl(url: string): void {
    this.externalLinkProvider.open(url);
  }

  private sendPaymentToAddress(bitcoinAddress: string, coin: string): void {
    this.navCtrl.push(AmountPage, { toAddress: bitcoinAddress, coin });
  }

  private addToAddressBook(bitcoinAddress: string): void {
    this.navCtrl.push(AddressbookAddPage, { addressbookEntry: bitcoinAddress });
  }

  private scanPaperWallet(privateKey: string) {
    this.navCtrl.push(PaperWalletPage, { privateKey });
  }

  private updateDesktopOnFocus() {
    const { remote } = (window as any).require('electron');
    const win = remote.getCurrentWindow();
    win.on('focus', () => {
      this.checkClipboard();
      this.getNotifications();
      this.setWallets();
    });
  }

  private openEmailDisclaimer() {
    let message = this.translate.instant(
      'By providing your email address, you give explicit consent to BitPay to use your email address to send you email notifications about payments.'
    );
    let title = this.translate.instant('Privacy Policy update');
    let okText = this.translate.instant('Accept');
    let cancelText = this.translate.instant('Disable notifications');
    this.popupProvider
      .ionicConfirm(title, message, okText, cancelText)
      .then(ok => {
        if (ok) {
          // Accept new Privacy Policy
          this.persistenceProvider.setEmailLawCompliance('accepted');
        } else {
          // Disable email notifications
          this.persistenceProvider.setEmailLawCompliance('rejected');
          this.emailProvider.updateEmail({
            enabled: false,
            email: 'null@email'
          });
        }
      });
  }

  private checkEmailLawCompliance(): void {
    setTimeout(() => {
      if (this.emailProvider.getEmailIfEnabled()) {
        this.persistenceProvider.getEmailLawCompliance().then(value => {
          if (!value) this.openEmailDisclaimer();
        });
      }
    }, 2000);
  }

  private startUpdatingWalletId(walletId: string) {
    this.updatingWalletId[walletId] = true;
  }

  private stopUpdatingWalletId(walletId: string) {
    setTimeout(() => {
      this.updatingWalletId[walletId] = false;
    }, 10000);
  }

  private setWallets = _.debounce(
    () => {
      this.wallets = this.profileProvider.getWallets();
      this.walletsBtc = _.filter(this.wallets, (x: any) => {
        return x.credentials.coin == 'btc';
      });
      this.walletsBch = _.filter(this.wallets, (x: any) => {
        return x.credentials.coin == 'bch';
      });
      this.updateAllWallets();
    },
    5000,
    {
      leading: true
    }
  );

  public checkHomeTip(): void {
    this.persistenceProvider.getHomeTipAccepted().then((value: string) => {
      this.homeTip = value == 'accepted' ? false : true;
    });
  }

  public hideHomeTip(): void {
    this.persistenceProvider.setHomeTipAccepted('accepted');
    this.homeTip = false;
  }

  private checkFeedbackInfo() {
    this.persistenceProvider.getFeedbackInfo().then(info => {
      if (!info) {
        this.initFeedBackInfo();
      } else {
        let feedbackInfo = info;
        // Check if current version is greater than saved version
        let currentVersion = this.releaseProvider.getCurrentAppVersion();
        let savedVersion = feedbackInfo.version;
        let isVersionUpdated = this.feedbackProvider.isVersionUpdated(
          currentVersion,
          savedVersion
        );
        if (!isVersionUpdated) {
          this.initFeedBackInfo();
          return;
        }
        let now = moment().unix();
        let timeExceeded = now - feedbackInfo.time >= 24 * 7 * 60 * 60;
        this.showRateCard = timeExceeded && !feedbackInfo.sent;
        // this.showCard.setShowRateCard(this.showRateCard);
      }
    });
  }

  public checkClipboard() {
    return this.clipboardProvider
      .getData()
      .then(async data => {
        this.validDataFromClipboard = this.incomingDataProvider.parseData(data);
        if (!this.validDataFromClipboard) {
          return;
        }
        const dataToIgnore = [
          'BitcoinAddress',
          'BitcoinCashAddress',
          'PlainUrl'
        ];
        if (dataToIgnore.indexOf(this.validDataFromClipboard.type) > -1) {
          this.validDataFromClipboard = null;
          return;
        }
        if (this.validDataFromClipboard.type === 'PayPro') {
          const coin: string =
            data.indexOf('bitcoincash') === 0 ? Coin.BCH : Coin.BTC;
          this.incomingDataProvider
            .getPayProDetails(data)
            .then(payProDetails => {
              if (!payProDetails) {
                throw this.translate.instant('No wallets available');
              }
              this.payProDetailsData = payProDetails;
              this.payProDetailsData.coin = coin;
              this.clearCountDownInterval();
              this.paymentTimeControl(this.payProDetailsData.expires);
            })
            .catch(err => {
              this.payProDetailsData = {};
              this.payProDetailsData.error = err;
              this.logger.warn('Error in Payment Protocol', err);
            });
        }
        await Observable.timer(50).toPromise();
        this.slideDown = true;
      })
      .catch(() => {
        this.logger.warn('Paste from clipboard err');
      });
  }

  public hideClipboardCard() {
    this.validDataFromClipboard = null;
    this.clipboardProvider.clear();
    this.slideDown = false;
  }

  public processClipboardData(data): void {
    this.clearCountDownInterval();
    this.incomingDataProvider.redir(data, { fromHomeCard: true });
  }

  private clearCountDownInterval(): void {
    if (this.countDown) clearInterval(this.countDown);
  }

  private paymentTimeControl(expirationTime): void {
    let setExpirationTime = (): void => {
      let now = Math.floor(Date.now() / 1000);
      if (now > expirationTime) {
        this.remainingTimeStr = this.translate.instant('Expired');
        this.clearCountDownInterval();
        return;
      }
      let totalSecs = expirationTime - now;
      let m = Math.floor(totalSecs / 60);
      let s = totalSecs % 60;
      this.remainingTimeStr = ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
    };

    setExpirationTime();

    this.countDown = setInterval(() => {
      setExpirationTime();
    }, 1000);
  }

  private initFeedBackInfo() {
    this.persistenceProvider.setFeedbackInfo({
      time: moment().unix(),
      version: this.releaseProvider.getCurrentAppVersion(),
      sent: false
    });
    this.showRateCard = false;
  }

  private updateWallet(walletId: string): void {
    if (this.updatingWalletId[walletId]) return;
    this.startUpdatingWalletId(walletId);
    let wallet = this.profileProvider.getWallet(walletId);
    this.walletProvider
      .getStatus(wallet, {})
      .then(status => {
        wallet.status = status;
        wallet.error = null;
        this.profileProvider.setLastKnownBalance(
          wallet.id,
          wallet.status.availableBalanceStr
        );

        // Update recent transactions and txps
        this.updateTxps();
        this.getNotifications();

        this.stopUpdatingWalletId(walletId);
      })
      .catch(err => {
        this.logger.error(err);
        this.stopUpdatingWalletId(walletId);
      });
  }

  private debounceUpdateTxps = _.debounce(
    () => {
      this.updateTxps();
    },
    5000,
    {
      leading: true
    }
  );

  // private updateTxHistory(wallet) {
  //   let progressFn = function (_, newTxs) {
  //     if (newTxs > 5) this.thistory = null;
  //     this.updatingTxHistoryProgress = newTxs;
  //   }.bind(this);

  //   this.walletProvider
  //     .getTxHistory(wallet, {
  //       progressFn
  //     })
  //     .then(txHistory => {

  //       let hasTx = txHistory[0];

  //       // {{tx.action == 'received'?'+':(tx.action == 'sent'?'-':'')}}{{tx.amount | satToUnit: wallet.coin}}

  //     })
  //     .catch(err => {
  //       this.logger.error(err);
  //     });
  // }

  private updateTxps() {
    this.profileProvider
      .getTxps({ limit: 3 })
      .then(data => {
        this.zone.run(() => {
          this.txps = data.txps;
          this.txpsN = data.n;
        });
      })
      .catch(err => {
        this.logger.error(err);
      });
  }

  private debounceUpdateNotifications = _.debounce(
    () => {
      this.getNotifications();
    },
    5000,
    {
      leading: true
    }
  );

  private getNotifications() {
    if (!this.recentTransactionsEnabled) return;
    this.profileProvider
      .getNotifications({ limit: 3 })
      .then(data => {
        this.zone.run(() => {
          this.notifications = data.notifications;
          this.notificationsN = data.total;
        });
      })
      .catch(err => {
        this.logger.error(err);
      });
  }

  private updateAllWallets(): void {
    let foundMessage = false;

    if (_.isEmpty(this.wallets)) return;

    let pr = wallet => {
      return new Promise(resolve => {
        this.walletProvider
          .getStatus(wallet, {})
          .then(status => {
            wallet.status = status;
            wallet.error = null;

            if (!foundMessage && !_.isEmpty(status.serverMessage)) {
              this.serverMessage = status.serverMessage;
              foundMessage = true;
            }

            this.profileProvider.setLastKnownBalance(
              wallet.id,
              wallet.status.availableBalanceStr
            );
            return resolve();
          })
          .catch(err => {
            wallet.error =
              err === 'WALLET_NOT_REGISTERED'
                ? 'Wallet not registered'
                : this.bwcErrorProvider.msg(err);
            this.logger.warn(
              this.bwcErrorProvider.msg(
                err,
                'Error updating status for ' + wallet.name
              )
            );
            return resolve();
          });
      });
    };
    this.totalBalance = 0;
    this.balanceItem = [];
    // this.balanceName = [];
    // map wallet
    _.each(this.wallets, (wallet) => {
      pr(wallet).then(() => {
        this.debounceUpdateTxps();
        this.debounceUpdateNotifications();
        let banlance =
          wallet.status && wallet.status.totalBalanceStr
            ? wallet.status.totalBalanceStr
            : wallet.cachedBalance
              ? wallet.cachedBalance
              : '';

        // this.updateTxHistory(wallet);

        let alternativeBalance = wallet.status.totalBalanceAlternative;
        if (alternativeBalance && alternativeBalance.indexOf(",") != -1) {
          alternativeBalance = alternativeBalance.replace(/,/g, "");
          // this.logger.warn('wallet.status.totalBalanceAlternative', alternativeBalance);

        }

        let alternativeUnitOne = wallet.status.alternativeIsoCode;
        let amount = banlance.split(' ')[0];
        if (amount && amount.indexOf(",") != -1) {
          amount = amount.replace(/,/g, "");
        }

        this.totalBalance += parseFloat(alternativeBalance);
        // this.balanceItem.push({ value: parseFloat(amount) });
        this.balanceItem.push({
          name: banlance.split(' ')[1],
          value: parseFloat(amount),
          alternativeBalance: parseFloat(alternativeBalance),
          alternativeUnit: alternativeUnitOne
        });

        // this.logger.warn('wallet every---', parseFloat(alternativeBalance));
        // No serverMessage for any wallet?
        if (!foundMessage) this.serverMessage = null;
      })
        .then(() => { // Add a callback for each. Update the chart.
          // this.logger.warn('wallet then', this.totalBalance);
          this.balanceLegend = [];
          this.chartLegend = [];
          this.alternativeUnit = this.balanceItem[0].alternativeUnit;
          _.each(this.balanceItem, (balanceItem, index: number) => {
            let legendOne = {
              color: this.legendColors[index],
              name: balanceItem.name,
              percent: balanceItem.alternativeBalance * 100 / this.totalBalance
            }
            this.selectedLegendColors.push(this.legendColors[index]);
            this.balanceLegend.push(legendOne);
            // this.logger.warn('wallet every---', legendOne);
            let legendChartOne = {
              value: balanceItem.alternativeBalance,
              itemStyle: {
                normal: { color: this.legendColors[index] }
              }
            }
            this.chartLegend.push(legendChartOne);

          })
          // this.logger.warn('wallet then', wallet);

          this.balanceChart.setOption({
            // color: this.selectedLegendColors,
            series: [
              {
                data: this.chartLegend
              }
            ]
          })
        });
    });
  }

  private checkUpdate(): void {
    this.releaseProvider
      .getLatestAppVersion()
      .toPromise()
      .then(version => {
        this.latestVersion = version;
        this.logger.debug('Current app version:', version);
        var result = this.releaseProvider.checkForUpdates(version);
        this.logger.debug('Update available:', result.updateAvailable);
        if (result.updateAvailable) {
          this.newRelease = true;
          this.updateText = this.replaceParametersProvider.replace(
            this.translate.instant(
              'There is a new version of {{nameCase}} available'
            ),
            { nameCase: this.appProvider.info.nameCase }
          );
        }
      })
      .catch(err => {
        this.logger.error('Error getLatestAppVersion', err);
      });
  }

  public openServerMessageLink(): void {
    let url = this.serverMessage.link;
    this.externalLinkProvider.open(url);
  }
  // pages switch
  public goToAddView(): void {
    this.navCtrl.push(AddPage);
  }

  public goToAddressbook(): void {
    this.navCtrl.push(AddressbookPage);
  }

  // 当点击BTC或者BCH钱包的具体某一项
  public goToWalletDetails(wallet): void {
    if (this.showReorderBtc || this.showReorderBch) return;
    // 取消订阅finishIncomingDataMenuEvent和bwsEvent事件
    this.events.unsubscribe('finishIncomingDataMenuEvent');
    this.events.unsubscribe('bwsEvent');
    // 提交一个event给 OpenWallet事件
    this.events.publish('OpenWallet', wallet);
  }

  public openNotificationModal(n) {
    let wallet = this.profileProvider.getWallet(n.walletId);

    if (n.txid) {
      this.navCtrl.push(TxDetailsPage, { walletId: n.walletId, txid: n.txid });
    } else {
      var txp = _.find(this.txps, {
        id: n.txpId
      });
      if (txp) {
        this.openTxpModal(txp);
      } else {
        this.onGoingProcessProvider.set('loadingTxInfo');
        this.walletProvider
          .getTxp(wallet, n.txpId)
          .then(txp => {
            var _txp = txp;
            this.onGoingProcessProvider.clear();
            this.openTxpModal(_txp);
          })
          .catch(() => {
            this.onGoingProcessProvider.clear();
            this.logger.warn('No txp found');
            let title = this.translate.instant('Error');
            let subtitle = this.translate.instant('Transaction not found');
            return this.popupProvider.ionicAlert(title, subtitle);
          });
      }
    }
  }

  // public legendGenerate(indexes): void {
  //   // let element = this.walletsBtc[indexes.from];
  //   // this.walletsBtc.splice(indexes.from, 1);
  //   // this.walletsBtc.splice(indexes.to, 0, element);
  //   _.each(this.balanceLegend, (legend, index: number) => {
  //     // this.profileProvider.setWalletOrder(wallet.id, index);
  //     this.logger.warn('wallet btc!!!!!', legend);

  //   });
  // }

  public reorderBtc(): void {
    this.showReorderBtc = !this.showReorderBtc;
  }

  public reorderBch(): void {
    this.showReorderBch = !this.showReorderBch;
  }

  public reorderWalletsBtc(indexes): void {
    let element = this.walletsBtc[indexes.from];
    this.walletsBtc.splice(indexes.from, 1);
    this.walletsBtc.splice(indexes.to, 0, element);
    _.each(this.walletsBtc, (wallet, index: number) => {
      this.profileProvider.setWalletOrder(wallet.id, index);
    });
    // this.logger.warn('wallet btc!!!!!', this.walletsBtc);
  }

  public reorderWalletsBch(indexes): void {
    let element = this.walletsBch[indexes.from];
    this.walletsBch.splice(indexes.from, 1);
    this.walletsBch.splice(indexes.to, 0, element);
    _.each(this.walletsBch, (wallet, index: number) => {
      this.profileProvider.setWalletOrder(wallet.id, index);
    });
    // this.logger.warn('wallet bch!!!!!!', this.walletsBch);
  }

  public goToDownload(): void {
    let url: string;
    let okText: string;
    let appName = this.appProvider.info.nameCase;
    let OS = this.platformProvider.getOS();

    if (OS.extension !== '') {
      okText = this.translate.instant('Download');
      url =
        'https://github.com/bitpay/copay/releases/download/' +
        this.latestVersion +
        '/' +
        appName +
        OS.extension;
    } else {
      okText = this.translate.instant('View Update');
      url = 'https://github.com/bitpay/copay/releases/latest';
    }

    let optIn = true;
    let title = this.translate.instant('Update Available');
    let message = this.translate.instant(
      'An update to this app is available. For your security, please update to the latest version.'
    );
    let cancelText = this.translate.instant('Go Back');
    this.externalLinkProvider.open(
      url,
      optIn,
      title,
      message,
      okText,
      cancelText
    );
  }

  public openTxpModal(tx): void {
    let modal = this.modalCtrl.create(
      TxpDetailsPage,
      { tx },
      { showBackdrop: false, enableBackdropDismiss: false }
    );
    modal.present();
  }

  public openProposalsPage(): void {
    this.navCtrl.push(ProposalsPage);
  }

  public openActivityPage(): void {
    this.navCtrl.push(ActivityPage);
  }

  public goTo(page: string): void {
    const pageMap = {
      BitPayCardIntroPage,
      CoinbasePage,
      GlideraPage,
      ShapeshiftPage
    };
    this.navCtrl.push(pageMap[page]);
  }

  public goToCard(cardId): void {
    this.navCtrl.push(BitPayCardPage, { id: cardId });
  }

  public doRefresh(refresher) {
    this.setWallets();
    setTimeout(() => {
      refresher.complete();
    }, 2000);
  }

  // public scan() {
  //   this.navCtrl.parent.select(1);
  // }

  public scan(): void {
    this.navCtrl.push(ScanPage);
  }
  public settings() {
    this.navCtrl.push(SettingsPage);
  }
}
