/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  createSignal,
  createEffect,
  onMount,
  Show,
  onCleanup,
  startTransition,
  Component,
} from "solid-js";

import {
  init,
  dispose,
  utils,
  Nullable,
  Chart,
  OverlayMode,
  Styles,
  TooltipIconPosition,
  ActionType,
  PaneOptions,
  Indicator,
  DomPosition,
  FormatDateType,
  OverlayCreate,
} from "klinecharts";

import lodashSet from "lodash/set";
import lodashClone from "lodash/cloneDeep";
import axios from "axios";


import { SelectDataSourceItem, Loading } from "./component";

import {
  PeriodBar,
  DrawingBar,
  IndicatorModal,
  TimezoneModal,
  SettingModal,
  ScreenshotModal,
  IndicatorSettingModal,
  SymbolSearchModal,
  LayoutSearchModal,
} from "./widget";

import { translateTimezone } from "./widget/timezone-modal/data";

import { SymbolInfo, Period, ChartProOptions, ChartPro } from "./types";
import CreateLayoutModal from "./widget/layout-modal/CreateLayout";

export interface LayoutInfo {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  date: string;
}

export interface ChartProComponentProps
  extends Required<Omit<ChartProOptions, "container">> {
  ref: (chart: ChartPro) => void;
}

interface PrevSymbolPeriod {
  symbol: SymbolInfo;
  period: Period;
}

function createIndicator(
  widget: Nullable<Chart>,
  indicatorName: string,
  isStack?: boolean,
  paneOptions?: PaneOptions
): Nullable<string> {
  if (indicatorName === "VOL") {
    paneOptions = { gap: { bottom: 2 }, ...paneOptions };
  }
  return (
    widget?.createIndicator(
      {
        name: indicatorName,
        // @ts-expect-error
        createTooltipDataSource: ({ indicator, defaultStyles }) => {
          const icons = [];
          if (indicator.visible) {
            icons.push(defaultStyles.tooltip.icons[1]);
            icons.push(defaultStyles.tooltip.icons[2]);
            icons.push(defaultStyles.tooltip.icons[3]);
          } else {
            icons.push(defaultStyles.tooltip.icons[0]);
            icons.push(defaultStyles.tooltip.icons[2]);
            icons.push(defaultStyles.tooltip.icons[3]);
          }
          return { icons };
        },
      },
      isStack,
      paneOptions
    ) ?? null
  );
}

const ChartProComponent: Component<ChartProComponentProps> = (props) => {
  let widgetRef: HTMLDivElement | undefined = undefined;
  let widget: Nullable<Chart> = null;

  let priceUnitDom: HTMLElement;

  let loading = false;

  const [theme, setTheme] = createSignal(props.theme);
  const [styles, setStyles] = createSignal(props.styles);
  const [locale, setLocale] = createSignal(props.locale);

  const [symbol, setSymbol] = createSignal(props.symbol);
  const [period, setPeriod] = createSignal(props.period);
  const [indicatorModalVisible, setIndicatorModalVisible] = createSignal(false);
  const [mainIndicators, setMainIndicators] = createSignal([
    ...props.mainIndicators!,
  ]);
  const [subIndicators, setSubIndicators] = createSignal({});

  const [timezoneModalVisible, setTimezoneModalVisible] = createSignal(false);
  const [loadLayoutModalVisible, setLoadLayoutModalVisible] = createSignal(false);
  const [createLayoutModalVisible, setCreateLayoutModalVisible] = createSignal(false);
  const [timezone, setTimezone] = createSignal<SelectDataSourceItem>({
    key: props.timezone,
    text: translateTimezone(props.timezone, props.locale),
  });

  const [settingModalVisible, setSettingModalVisible] = createSignal(false);
  const [widgetDefaultStyles, setWidgetDefaultStyles] = createSignal<Styles>();

  const [screenshotUrl, setScreenshotUrl] = createSignal("");

  const [drawingBarVisible, setDrawingBarVisible] = createSignal(
    props.drawingBarVisible
  );

  const [symbolSearchModalVisible, setSymbolSearchModalVisible] =
    createSignal(false);

  const [loadingVisible, setLoadingVisible] = createSignal(false);

  const [indicatorSettingModalParams, setIndicatorSettingModalParams] =
    createSignal({
      visible: false,
      indicatorName: "",
      paneId: "",
      calcParams: [] as Array<any>,
    });

  props.ref({
    setTheme,
    getTheme: () => theme(),
    setStyles,
    getStyles: () => widget!.getStyles(),
    setLocale,
    getLocale: () => locale(),
    setTimezone: (timezone: string) => {
      setTimezone({
        key: timezone,
        text: translateTimezone(props.timezone, locale()),
      });
    },
    getTimezone: () => timezone().key,
    setSymbol,
    getSymbol: () => symbol(),
    setPeriod,
    getPeriod: () => period(),
  });

  const documentResize = () => {
    widget?.resize();
  };

  const adjustFromTo = (period: Period, toTimestamp: number, count: number) => {
    let to = toTimestamp;
    let from = to;
    switch (period.timespan) {
      case "minute": {
        to = to - (to % (60 * 1000));
        from = to - count * period.multiplier * 60 * 1000;
        break;
      }
      case "hour": {
        to = to - (to % (60 * 60 * 1000));
        from = to - count * period.multiplier * 60 * 60 * 1000;
        break;
      }
      case "day": {
        to = to - (to % (60 * 60 * 1000));
        from = to - count * period.multiplier * 24 * 60 * 60 * 1000;
        break;
      }
      case "week": {
        const date = new Date(to);
        const week = date.getDay();
        const dif = week === 0 ? 6 : week - 1;
        to = to - dif * 60 * 60 * 24;
        const newDate = new Date(to);
        to = new Date(
          `${newDate.getFullYear()}-${
            newDate.getMonth() + 1
          }-${newDate.getDate()}`
        ).getTime();
        from = count * period.multiplier * 7 * 24 * 60 * 60 * 1000;
        break;
      }
      case "month": {
        const date = new Date(to);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        to = new Date(`${year}-${month}-01`).getTime();
        from = count * period.multiplier * 30 * 24 * 60 * 60 * 1000;
        const fromDate = new Date(from);
        from = new Date(
          `${fromDate.getFullYear()}-${fromDate.getMonth() + 1}-01`
        ).getTime();
        break;
      }
      case "year": {
        const date = new Date(to);
        const year = date.getFullYear();
        to = new Date(`${year}-01-01`).getTime();
        from = count * period.multiplier * 365 * 24 * 60 * 60 * 1000;
        const fromDate = new Date(from);
        from = new Date(`${fromDate.getFullYear()}-01-01`).getTime();
        break;
      }
    }
    return [from, to];
  };

  onMount(() => {
    window.addEventListener("resize", documentResize);
    widget = init(widgetRef!, {
      customApi: {
        formatDate: (
          dateTimeFormat: Intl.DateTimeFormat,
          timestamp,
          format: string,
          type: FormatDateType
        ) => {
          const p = period();
          switch (p.timespan) {
            case "minute": {
              if (type === FormatDateType.XAxis) {
                return utils.formatDate(dateTimeFormat, timestamp, "HH:mm");
              }
              return utils.formatDate(
                dateTimeFormat,
                timestamp,
                "YYYY-MM-DD HH:mm"
              );
            }
            case "hour": {
              if (type === FormatDateType.XAxis) {
                return utils.formatDate(
                  dateTimeFormat,
                  timestamp,
                  "MM-DD HH:mm"
                );
              }
              return utils.formatDate(
                dateTimeFormat,
                timestamp,
                "YYYY-MM-DD HH:mm"
              );
            }
            case "day":
            case "week":
              return utils.formatDate(dateTimeFormat, timestamp, "YYYY-MM-DD");
            case "month": {
              if (type === FormatDateType.XAxis) {
                return utils.formatDate(dateTimeFormat, timestamp, "YYYY-MM");
              }
              return utils.formatDate(dateTimeFormat, timestamp, "YYYY-MM-DD");
            }
            case "year": {
              if (type === FormatDateType.XAxis) {
                return utils.formatDate(dateTimeFormat, timestamp, "YYYY");
              }
              return utils.formatDate(dateTimeFormat, timestamp, "YYYY-MM-DD");
            }
          }
          return utils.formatDate(
            dateTimeFormat,
            timestamp,
            "YYYY-MM-DD HH:mm"
          );
        },
      },
    });

    if (widget) {
      const watermarkContainer = widget.getDom("candle_pane", DomPosition.Main);
      if (watermarkContainer) {
        let watermark = document.createElement("div");
        watermark.className = "klinecharts-pro-watermark";
        if (utils.isString(props.watermark)) {
          const str = (props.watermark as string).replace(/(^\s*)|(\s*$)/g, "");
          watermark.innerHTML = str;
        } else {
          watermark.appendChild(props.watermark as Node);
        }
        watermarkContainer.appendChild(watermark);
      }

      const priceUnitContainer = widget.getDom(
        "candle_pane",
        DomPosition.YAxis
      );
      priceUnitDom = document.createElement("span");
      priceUnitDom.className = "klinecharts-pro-price-unit";
      priceUnitContainer?.appendChild(priceUnitDom);
    }

    mainIndicators().forEach((indicator) => {
      createIndicator(widget, indicator, true, { id: "candle_pane" });
    });
    const subIndicatorMap = {};
    props.subIndicators!.forEach((indicator) => {
      const paneId = createIndicator(widget, indicator, true);
      if (paneId) {
        // @ts-expect-error
        subIndicatorMap[indicator] = paneId;
      }
    });
    setSubIndicators(subIndicatorMap);
    // widget?.loadMore(timestamp => {
    //   loading = true
    //   const get = async () => {
    //     const p = period()
    //     const [to] = adjustFromTo(p, timestamp!, 1)
    //     const [from] = adjustFromTo(p, to, 500)
    //     const kLineDataList = await props.datafeed.getHistoryKLineData(symbol(), p, from, to)
    //     widget?.applyMoreData(kLineDataList, kLineDataList.length > 0)
    //     loading = false
    //   }
    //   get()
    // })
    widget?.subscribeAction(ActionType.OnTooltipIconClick, (data) => {
      if (data.indicatorName) {
        switch (data.iconId) {
          case "visible": {
            widget?.overrideIndicator(
              { name: data.indicatorName, visible: true },
              data.paneId
            );
            break;
          }
          case "invisible": {
            widget?.overrideIndicator(
              { name: data.indicatorName, visible: false },
              data.paneId
            );
            break;
          }
          case "setting": {
            const indicator = widget?.getIndicatorByPaneId(
              data.paneId,
              data.indicatorName
            ) as Indicator;
            setIndicatorSettingModalParams({
              visible: true,
              indicatorName: data.indicatorName,
              paneId: data.paneId,
              calcParams: indicator.calcParams,
            });
            break;
          }
          case "close": {
            if (data.paneId === "candle_pane") {
              const newMainIndicators = [...mainIndicators()];
              widget?.removeIndicator("candle_pane", data.indicatorName);
              newMainIndicators.splice(
                newMainIndicators.indexOf(data.indicatorName),
                1
              );
              setMainIndicators(newMainIndicators);
            } else {
              const newIndicators = { ...subIndicators() };
              widget?.removeIndicator(data.paneId, data.indicatorName);
              // @ts-expect-error
              delete newIndicators[data.indicatorName];
              setSubIndicators(newIndicators);
            }
          }
        }
      }
    });
  });

  onCleanup(() => {
    window.removeEventListener("resize", documentResize);
    dispose(widgetRef!);
  });

  createEffect(() => {
    const s = symbol();
    if (s?.priceCurrency) {
      priceUnitDom.innerHTML = s?.priceCurrency.toLocaleUpperCase();
      priceUnitDom.style.display = "flex";
    } else {
      priceUnitDom.style.display = "none";
    }
    widget?.setPriceVolumePrecision(
      s?.pricePrecision ?? 2,
      s?.volumePrecision ?? 0
    );
  });

  createEffect((prev?: PrevSymbolPeriod) => {
    if (!loading) {
      // if (prev) {
      //   props.datafeed.unsubscribe(prev.symbol, prev.period)
      // }
      const s = symbol();
      console.log("s", s);
      const p = period();
      loading = true;
      setLoadingVisible(true);
      const get = async () => {
        const [from, to] = adjustFromTo(p, new Date().getTime(), 500);
        const kLineDataList = await props.datafeed.getHistoryKLineData(
          s,
          p,
          from,
          to
        );
        console.log("from", new Date(from), "to", new Date(to));
        widget?.applyNewData(kLineDataList, kLineDataList.length > 0);
        // props.datafeed.subscribe(s, p, data => {
        //   widget?.updateData(data)
        // })
        loading = false;
        setLoadingVisible(false);
      };
      get();
      return { symbol: s, period: p };
    }
    return prev;
  });

  createEffect(() => {
    const t = theme();
    widget?.setStyles(t);
    const color = t === "dark" ? "#929AA5" : "#76808F";
    widget?.setStyles({
      indicator: {
        tooltip: {
          icons: [
            {
              id: "visible",
              position: TooltipIconPosition.Middle,
              marginLeft: 8,
              marginTop: 7,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              icon: "\ue903",
              fontFamily: "icomoon",
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: "transparent",
              activeBackgroundColor: "rgba(22, 119, 255, 0.15)",
            },
            {
              id: "invisible",
              position: TooltipIconPosition.Middle,
              marginLeft: 8,
              marginTop: 7,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              icon: "\ue901",
              fontFamily: "icomoon",
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: "transparent",
              activeBackgroundColor: "rgba(22, 119, 255, 0.15)",
            },
            {
              id: "setting",
              position: TooltipIconPosition.Middle,
              marginLeft: 6,
              marginTop: 7,
              marginBottom: 0,
              marginRight: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              icon: "\ue902",
              fontFamily: "icomoon",
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: "transparent",
              activeBackgroundColor: "rgba(22, 119, 255, 0.15)",
            },
            {
              id: "close",
              position: TooltipIconPosition.Middle,
              marginLeft: 6,
              marginTop: 7,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              icon: "\ue900",
              fontFamily: "icomoon",
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: "transparent",
              activeBackgroundColor: "rgba(22, 119, 255, 0.15)",
            },
          ],
        },
      },
    });
  });

  createEffect(() => {
    widget?.setLocale(locale());
  });

  createEffect(() => {
    widget?.setTimezone(timezone().key);
  });

  createEffect(() => {
    if (styles()) {
      widget?.setStyles(styles());
      setWidgetDefaultStyles(lodashClone(widget!.getStyles()));
    }
  });

 

  let overlaysMap = new Map();
  const testLayoutData: LayoutInfo[] = [
    {
      id:'1',
      name: 'Daily Trend Analysis',
      symbol: 'BTC/USD',
      timeframe: '1D',
      date: '2023-07-01'
    },
    {
      id:'2',
      name: 'Intraday Scalp',
      symbol: 'ETH/USD',
      timeframe: '15m',
      date: '2023-07-02'
    },
    {
      id:'3',
      name: 'Weekly Overview',
      symbol: 'XRP/USD',
      timeframe: '1W',
      date: '2023-06-30'
    },
    {
      id:'4',
      name: 'Breakout Watch',
      symbol: 'ADA/USD',
      timeframe: '4H',
      date: '2023-07-03'
    },
    {
      id:'5',
      name: 'Swing Trade Setup',
      symbol: 'LTC/USD',
      timeframe: '12H',
      date: '2023-07-04'
    },
  ];

  let overlaysMap2 = [
    {
      key: "overlay_1703111554384",
      value: {
        name: "circle",
        lock: false,
        mode: "normal",
        visible: true,
        id: "overlay_1703111554384",
        groupId: "drawing_tools",
        points: [
          {
            timestamp: 1696982400000,
            dataIndex: 933,
            value: 27700.517887563885,
          },
          {
            timestamp: 1699228800000,
            dataIndex: 959,
            value: 34847.72078364566,
          },
        ],
      },
    },
    {
      key: "overlay_1703110966156",
      value: {
        name: "fibonacciLine",
        lock: false,
        mode: "normal",
        visible: true,
        id: "overlay_1703110966156",
        groupId: "drawing_tools",
        points: [
          {
            timestamp: 1696118400000,
            dataIndex: 923,
            value: 29015.954003407154,
          },
          {
            timestamp: 1699142400000,
            dataIndex: 958,
            value: 36031.613287904605,
          },
        ],
      },
    },
    {
      key: "overlay_1703102805727_1",
      value: {
        name: "circle",
        lock: false,
        mode: "normal",
        visible: true,
        id: "overlay_1703102805727_1",
        groupId: "drawing_tools",
        points: [
          {
            timestamp: 1656201600000,
            dataIndex: 461,
            value: 26718.775468483815,
          },
          {
            timestamp: 1686528000000,
            dataIndex: 812,
            value: 43195.41396933561,
          },
        ],
      },
    },
    {
      key: "overlay_1703111571486",
      value: {
        name: "xabcd",
        lock: false,
        mode: "normal",
        id: "overlay_1703111571486",
        points: [
          {
            timestamp: 1692403200000,
            dataIndex: 880,
            value: 25902.755195911413,
          },
          {
            timestamp: 1693699200000,
            dataIndex: 895,
            value: 28358.23594548552,
          },
          {
            timestamp: 1694736000000,
            dataIndex: 907,
            value: 25990.45093696763,
          },
          {
            timestamp: 1696982400000,
            dataIndex: 933,
            value: 28489.779557069844,
          },
          {
            timestamp: 1697500800000,
            dataIndex: 939,
            value: 27174.343441226574,
          },
        ],
      },
    },
  ];

  const [layouts, setLayouts] = createSignal(testLayoutData);

  // Method to handle deletion
  const handleLayoutDelete = (layoutId: string) => {
    console.log('11',layouts())
    setLayouts(layouts => layouts.filter(layout => layout.id !== layoutId));
    console.log('12',layouts())

  };

  function createOverlaysFromTestData(widget:any, overlaysData:any) {
    overlaysData.forEach((overlayEntry:any) => {
      // Skip this entry if the key is undefined
      if (overlayEntry.key === undefined) {
        console.warn("Skipped overlay due to undefined key:", overlayEntry);
        return;
      }

      const overlayId = overlayEntry.key;
      const overlayData = overlayEntry.value;

      // Ensure overlay data has an id property
      if (!overlayData.id) {
        overlayData.id = overlayId;
      }
      overlaysMap.set(overlayData.id, overlayData);

      const modifiedOverlay = {
        ...overlayData,
        onDrawEnd: (event:any) => {
          console.log("Draw End Event:", event);
          const updatedOverlay = formatOverlayData({
            ...overlayData,
            ...event,
          });
          overlaysMap.set(updatedOverlay.id, updatedOverlay);
          if (overlayData.onDrawEnd) return overlayData.onDrawEnd(event);
          return true;
        },
        onPressedMoveEnd: (event:any) => {
          console.log("Pressed Move End Event:", event);
          const updatedOverlay = formatOverlayData({
            ...overlayData,
            ...event,
          });
          overlaysMap.set(updatedOverlay.id, updatedOverlay);
          if (overlayData.onPressedMoveEnd)
            return overlayData.onPressedMoveEnd(event);
          return true;
        },
        onRemoved: (event:any) => {
          console.log("Overlay Removed Event:", event);
          const overlayId = event.overlay.id;
          console.log("Removing overlay with ID:", overlayId);
          return removeOverlay(overlayId);
        },
      };

      console.log("Creating overlay with modified settings:", modifiedOverlay);
      // Create the overlay with the modified object
      widget?.createOverlay(modifiedOverlay);
    });
  }

  function formatOverlayData(overlayData:any) {
    const overlayId = overlayData.overlay?.id || overlayData.id;
    console.log("overlayIdoverlayId", overlayId, overlayData.id);
    if (!overlayId) {
      console.error("Missing id in overlay data", overlayData);
      // Assign a fallback id if none is found
      overlayData.id = `overlay_${Date.now()}`;
    }

    return {
      name: overlayData.name,
      lock: overlayData.lock,
      mode: overlayData.mode,
      visible: overlayData.visible,
      id: overlayId, // Use the id from the overlay object
      groupId: overlayData.groupId,
      points: overlayData.overlay?.points,
    };
  }

  function removeOverlay(overlayId:any) {
    console.log("Attempting to remove overlay with ID:", overlayId);
    if (overlaysMap.has(overlayId)) {
      overlaysMap.delete(overlayId);
      console.log("Overlay removed:", overlayId);
      console.log("overlaysMap", overlaysMap);
    } else {
      console.log("Overlay not found in map:", overlayId);
    }

    return true;
  }

  const currentLayout = "Sans template"; // Placeholder for the current layout

  const handleCreateLayout = (layoutInfo:any) => {
    // Logic to handle layout creation
    console.log('New Layout Created:', layoutInfo);
  };

    async function test3() {
    console.log("test started");
   const test = await axios.get("http://localhost:4000/test2");
   console.log('test', test)
   return test;
 }
  const onSaveLayout = async () => {
  test3();
    console.log('Layout saved successfully:');
   const test = await axios.get('http://localhost:4000/saveLayout')
   console.log('test1', test)
    // Gather layout data
    const layoutData = {
      symbol: symbol(),
      period: period(),
      mainIndicators: mainIndicators(),
      subIndicators: subIndicators(),
      overlays: Array.from(overlaysMap.values()), // Assuming overlaysMap contains all overlays data
      theme: theme(),
      // Add more chart state data as needed
    };
  
    try {
      const response = await axios.post('http://localhost:4000/saveLayout', layoutData)
      console.log('Layout saved successfully:', response.data);
    } catch (error) {
      console.error('Error saving layout:', error);
    }
  };


  const onLoadLayout = async (layoutId:any) => {
    console.log('Layout Load successfully:');

    try {
      const response = await axios.get(`http://localhost:4000/loadLayout/${layoutId}`);
      const layoutData = response.data;
  
      // Apply the layout data to the chart
      setSymbol(layoutData.symbol);
      setPeriod(layoutData.period);
      setMainIndicators(layoutData.mainIndicators);
      setSubIndicators(layoutData.subIndicators);
      setTheme(layoutData.theme);
      // Apply more chart state data as needed
  
      // Recreate overlays
      layoutData.overlays.forEach((overlayData: string | OverlayCreate) => {
        widget?.createOverlay(overlayData);
      });
  
      console.log('Layout loaded successfully:', layoutData);
    } catch (error) {
      console.error('Error loading layout:', error);
    }
  };
  

  return (
    <>
      <i class="icon-close klinecharts-pro-load-icon" />
      <Show when={createLayoutModalVisible()}>
  <CreateLayoutModal
    locale={props.locale}
    currentSymbol={symbol().ticker} // You need to define currentSymbol
    currentDate={new Date().toISOString().split('T')[0]} // Example current date
    currentPeriod={period().text} // You need to define currentPeriod
    onCreateLayout={handleCreateLayout}
    onClose={() => setCreateLayoutModalVisible(false)}
  />
</Show>
      <Show when={symbolSearchModalVisible()}>
        <SymbolSearchModal
          locale={props.locale}
          datafeed={props.datafeed}
          onSymbolSelected={(symbol) => {
            setSymbol(symbol);
          }}
          onClose={() => {
            setSymbolSearchModalVisible(false);
          }}
        />
      </Show>
      <Show when={indicatorModalVisible()}>
        <IndicatorModal
          locale={props.locale}
          mainIndicators={mainIndicators()}
          subIndicators={subIndicators()}
          onClose={() => {
            setIndicatorModalVisible(false);
          }}
          onMainIndicatorChange={(data) => {
            const newMainIndicators = [...mainIndicators()];
            if (data.added) {
              createIndicator(widget, data.name, true, { id: "candle_pane" });
              newMainIndicators.push(data.name);
            } else {
              widget?.removeIndicator("candle_pane", data.name);
              newMainIndicators.splice(newMainIndicators.indexOf(data.name), 1);
            }
            setMainIndicators(newMainIndicators);
          }}
          onSubIndicatorChange={(data) => {
            const newSubIndicators = { ...subIndicators() };
            if (data.added) {
              const paneId = createIndicator(widget, data.name);
              if (paneId) {
                // @ts-expect-error
                newSubIndicators[data.name] = paneId;
              }
            } else {
              if (data.paneId) {
                widget?.removeIndicator(data.paneId, data.name);
                // @ts-expect-error
                delete newSubIndicators[data.name];
              }
            }
            setSubIndicators(newSubIndicators);
          }}
        />
      </Show>
      <Show when={timezoneModalVisible()}>
        <TimezoneModal
          locale={props.locale}
          timezone={timezone()}
          onClose={() => {
            setTimezoneModalVisible(false);
          }}
          onConfirm={setTimezone}
        />
      </Show>
      <Show when={loadLayoutModalVisible()}>
        <LayoutSearchModal
          locale={props.locale}
          layoutData={layouts()} // Pass the data here
          onLayoutSelected={(layout) => {
            console.log("Selected layout:", layout);
            onLoadLayout(layout.id);
            setLoadLayoutModalVisible(false);
          }}
          onLayoutDelete={(layoutId) => {
            handleLayoutDelete(layoutId);
          }}          
          onClose={() => {
            setLoadLayoutModalVisible(false);
          }}
        />
      </Show>
      <Show when={settingModalVisible()}>
        <SettingModal
          locale={props.locale}
          currentStyles={utils.clone(widget!.getStyles())}
          onClose={() => {
            setSettingModalVisible(false);
          }}
          onChange={(style) => {
            widget?.setStyles(style);
          }}
          onRestoreDefault={(options: SelectDataSourceItem[]) => {
            const style = {};
            options.forEach((option) => {
              const key = option.key;
              lodashSet(
                style,
                key,
                utils.formatValue(widgetDefaultStyles(), key)
              );
            });
            widget?.setStyles(style);
          }}
        />
      </Show>
      <Show when={screenshotUrl().length > 0}>
        <ScreenshotModal
          locale={props.locale}
          url={screenshotUrl()}
          onClose={() => {
            setScreenshotUrl("");
          }}
        />
      </Show>
      <Show when={indicatorSettingModalParams().visible}>
        <IndicatorSettingModal
          locale={props.locale}
          params={indicatorSettingModalParams()}
          onClose={() => {
            setIndicatorSettingModalParams({
              visible: false,
              indicatorName: "",
              paneId: "",
              calcParams: [],
            });
          }}
          onConfirm={(params) => {
            const modalParams = indicatorSettingModalParams();
            widget?.overrideIndicator(
              { name: modalParams.indicatorName, calcParams: params },
              modalParams.paneId
            );
          }}
        />
      </Show>
      <PeriodBar
        locale={props.locale}
        symbol={symbol()}
        spread={drawingBarVisible()}
        period={period()}
        periods={props.periods}
        onMenuClick={async () => {
          try {
            await startTransition(() =>
              setDrawingBarVisible(!drawingBarVisible())
            );
            widget?.resize();
          } catch (e) {}
        }}
        onSymbolClick={() => {
          setSymbolSearchModalVisible(!symbolSearchModalVisible());
        }}
        onPeriodChange={setPeriod}
        onIndicatorClick={() => {
          setIndicatorModalVisible((visible) => !visible);
        }}
        onTimezoneClick={() => {
          setTimezoneModalVisible((visible) => !visible);
        }}
        onLoadLayoutClick={() => {
          setLoadLayoutModalVisible((visible) => !visible);
        }}
        onCreateLayoutClick={() => {
          setCreateLayoutModalVisible((visible) => !visible);
        }}
        onSaveLayoutClick={() => {
          console.log("saveLayout");
          onSaveLayout();
        }}
        onSettingClick={() => {
          setSettingModalVisible((visible) => !visible);
        }}
        onScreenshotClick={() => {
          if (widget) {
            const url = widget.getConvertPictureUrl(
              true,
              "jpeg",
              props.theme === "dark" ? "#151517" : "#ffffff"
            );
            setScreenshotUrl(url);
          }
        }}
      />
      <div class="klinecharts-pro-content">
        <Show when={loadingVisible()}>
          <Loading />
        </Show>
        <Show when={drawingBarVisible()}>
          <DrawingBar
            locale={props.locale}
            // onDrawingItemClick={overlay => { widget?.createOverlay(overlay) }}
            // onDrawingItemClick={handleDrawingItemClick}

            onDrawingItemClick={(overlay) => {
              const modifiedOverlay = {
                ...overlay,

                onDrawEnd: (event:any) => {
                  console.log("Draw End Event:", event);
                  // Format and update overlay in the map
                  const updatedOverlay = formatOverlayData({
                    ...overlay,
                    ...event,
                  });
                  overlaysMap.set(event.overlay.id, updatedOverlay);
                  if (overlay.onDrawEnd) return overlay.onDrawEnd(event);
                  return true;
                },
                onPressedMoveEnd: (event:any) => {
                  console.log("Pressed Move End Event:", event);
                  // Format and update overlay in the map
                  const updatedOverlay = formatOverlayData({
                    ...overlay,
                    ...event,
                  });
                  overlaysMap.set(event.overlay.id, updatedOverlay);
                  if (overlay.onPressedMoveEnd)
                    return overlay.onPressedMoveEnd(event);
                  return true;
                },
                onRemoved: (event:any) => {
                  console.log("Overlay Removed Event:", event);
                  // Remove the overlay from overlaysMap
                  overlaysMap.delete(event.overlay.id);
                  if (overlay.onRemoved) return overlay.onRemoved(event);
                  return true;
                },
              };

              // Format and set the initial overlay structure in overlaysMap
              console.log("overlay", overlay);
              overlaysMap.set(overlay.id, formatOverlayData(modifiedOverlay));

              // Create the overlay with the modified object
              widget?.createOverlay(modifiedOverlay);
            }}
            onModeChange={(mode) => {
              widget?.overrideOverlay({ mode: mode as OverlayMode });
            }}
            onLockChange={(lock) => {
              widget?.overrideOverlay({ lock });
            }}
            onVisibleChange={(visible) => {
              createOverlaysFromTestData(widget, overlaysMap2);
            }}
            // onRemoveClick={(groupId) => { widget?.removeOverlay({ groupId }) }}/>
            onRemoveClick={(groupId) => {
              console.log("overlaysMap", overlaysMap);
            }}
          />
        </Show>
        <div
          ref={widgetRef}
          class="klinecharts-pro-widget"
          data-drawing-bar-visible={drawingBarVisible()}
        />
      </div>
    </>
  );
};

export default ChartProComponent;
