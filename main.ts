//TODO handle ismoveming
//handle blinker state change  from another class
//lod scale
namespace sensors {
    export class MovementRecognizer {
        private sensor = new inputEx.AdaptiveInput(
            () => { return dataManipulation.rescale(Math.abs(input.acceleration(Dimension.Strength) - 1000), 1000, 255) }, 0.8, 0.2
        )
        public displayIOValues() {
            this.sensor.getData().displayIOValues()
        }
        public displayParametersValues() {
            this.sensor.getData().displayParametersValues()
        }
    }
}

namespace blinker {
    export class SimpleBlinker {
        private state: number;
        private STATE_IDLE = 0;
        private STATE_NORMAL = 1;
        private STATE_ALARM = 2;

        active: boolean
        alertLevel: number;

        private colors = [Colors.Red, Colors.Black, Colors.White];
        private backgrounds = [Colors.Black, Colors.Green, Colors.Red];
        private levels = [0.4, 0.7, 1];
        private brightnesses = [1, 20, 255];
        private waitTimes = [1000, 500, 100];
        constructor() {

        }
        public activate() {
            this.active = true;
            let me = this
            setTimeout(function () {
                while (me.active) {
                    me.ToBeSeenBlink(me.alertLevel);
                }
                light.setBrightness(0)
            }, 0)
        }
        public ToBeSeenBlink(alarmLevel: number) {
            this.strobe(alarmLevel)
            if (!this.active) return
            pause(this.waitTimes[this.state])
            this.pulse(alarmLevel)
            if (!this.active) return
        }
        private strobe(alarmLevel: number) {
            let level = this.brightnesses[this.state]
            for (let i = 0; i < 3; i++) this.blink(level, 20, 1)
            this.blink(level, 50, 1)
        }

        private pulse(alarmLevel: number) {
            let level = this.brightnesses[this.state]
            this.blink(level, 10, 3)
            this.blink(level, 4, 10)
        }


        public blink(brightness: number, v: number, wait: number) {
            light.setAll(this.colors[this.state])
            v = 255 / brightness * v;
            console.logValue("bright", brightness);
            for (let i = brightness; i > 0; i -= v) {
                if (!this.active) return
                light.setBrightness(i)
            }
            if (!this.active) return
            light.setAll(this.backgrounds[this.state])
            light.setBrightness(255)
            pause(wait)
        }
        public deactivate() {
            this.active = false;
        }
        public adapt(value: number) {
            if (value > 1)
                this.alertLevel = 1 / (4 - dataManipulation.rescale(value, 255, 4));
            if (this.alertLevel > this.levels[1]) this.state = this.STATE_ALARM
            else if (this.alertLevel < this.levels[0]) this.state = this.STATE_IDLE
            else this.state = this.STATE_NORMAL
            console.logValue("blinker state", this.state)
        }
    }
}

namespace inputEx {
    export class AddaptiveInputData {
        public rawValue: number
        public value: number
        public scaleMin: number
        public scaleMax: number

        constructor(rawValue: number, value: number, scaleMin: number, scaleMax: number) {
            this.rawValue = rawValue;
            this.value = value;
            this.scaleMin = scaleMin,
                this.scaleMax = scaleMax
        }

        public displayIOValues() {
            display.printValues(
                [
                    display.normalizeInput(this.value),
                    display.normalizeInput(this.rawValue),
                ],
                [
                    Colors.Green,
                    Colors.Blue,
                ],
                Colors.Red, this.rawValue);
        }
        public displayParametersValues() {
            display.printValues(
                [
                    display.normalizeInput(this.value),
                    display.normalizeInput(this.scaleMin),
                    display.normalizeInput(this.scaleMax)
                ],
                [
                    Colors.White,
                    Colors.Red,
                    Colors.Green
                ],
                Colors.Black, this.rawValue);
        }
    }

    export class AdaptiveInput {
        protected currentValue: filters.SimpleFilter
        protected min: filters.SimpleFilter
        protected max: filters.SimpleFilter
        protected rawValue: number
        protected getter: () => number

        constructor(getter: () => number, currentValueSensivity: number, historySensivity: number) {
            this.currentValue = filters.createSimpleFilter(1 - currentValueSensivity, 0)
            this.min = filters.createSimpleFilter(1 - historySensivity, 0);
            this.max = filters.createSimpleFilter(1 - historySensivity, 255);
            this.getter = getter;
        }

        public update() {
            let v = this.getter()
            this.rawValue = v
            let min = this.min.average()
            let max = this.max.average() + 0.9
            if (min > v) this.min.fill(v); else this.min.push(v)
            if (max < v) this.max.fill(v); else this.max.push(v)
            this.currentValue.push(dataManipulation.rescale(v - min, max - min, 255))
        }
        public getData() {
            return new inputEx.AddaptiveInputData(
                this.rawValue,
                this.currentValue.average(),
                this.min.average(),
                this.max.average()
            )
        }
        public logValues() {
            console.logValue("raw", this.rawValue);
            console.logValue("currentValue", this.currentValue.average());
            console.logValue("min", this.min.average());
            console.logValue("max", this.max.average());
        }



    }
}


namespace display {


    export function printValues(values: number[], colors: number[], bgColor: number, brightness: number) {
        let count = values.length;
        light.setBrightness(brightness);
        for (let i = 0; i < 10; i++) {
            let color = bgColor;
            for (let n = 0; n < count; n++) {
                if (values[n] == i) {
                    color = colors[n];
                    break;
                }
            }
            light.setPixelColor(i, color)
        }
    }

    export function normalizeInput(value: number) {
        return normalize(value, 255)
    }
    export function normalize(value: number, scale: number) {
        return Math.round(dataManipulation.rescale(value, scale, 9));
    }
}
namespace navigation {
    export class Menu {
        protected page = 0;
        protected item = 0;
        protected onBeforeMenuChangedHandler: (page: number, item: number) => void
        protected onMenuChangedHandler: (page: number, item: number) => void
        protected timer: number;
        constructor(
            pageCount: number, itemCount: number,
            onBeforeMenuChangedHandler: (page: number, item: number) => void,
            onMenuChangedHandler: (page: number, item: number) => void
        ) {
            let me = this;
            this.onBeforeMenuChangedHandler = onBeforeMenuChangedHandler
            this.onMenuChangedHandler = onMenuChangedHandler

            input.buttonA.onEvent(ButtonEvent.Click, function () {
                onBeforeMenuChangedHandler(this.page, this.item)
                this.page += 1;
                if (this.page >= pageCount) {
                    this.page = 0;
                }
                this.item = 0;
                me.propagateMenuChanged()
            })

            input.buttonB.onEvent(ButtonEvent.Click, function () {
                onBeforeMenuChangedHandler(this.page, this.item)
                this.item += 1;
                if (this.item >= itemCount) this.item = 0;
                me.propagateMenuChanged()
            })
        }

        public propagateMenuChanged() {
            if (this.timer != null) clearTimeout(this.timer)
            let me = this
            me.display()
            setTimeout(function () {
                me.display()
            }, 100)
            setTimeout(function () {
                me.display()
            }, 700)

            let timer = setTimeout(function () {
                me.onMenuChangedHandler(this.page, this.item)
            }, 2000)
        }

        public display() {
            light.setBrightness(120)
            light.setAll(Colors.Black)
            light.setPixelColor(this.page, Colors.Red)
            light.setPixelColor(9 - this.item, Colors.Blue)
        }
    }
}

namespace filters {

    export function createSimpleFilter(amount: number, initialValue: number): SimpleFilter {
        return new SimpleFilter(amount, initialValue);
    }

    export class SimpleFilter {
        protected data = [0];

        constructor(amount: number, initialValue: number) {
            console.logValue("amount", amount)
            for (let i = 0; i < amount * 100; i++) {
                this.data[i] = initialValue;
            }
        }

        push(value: number): void {
            this.data.shift();
            this.data.push(value);
        }

        average(): number {
            let res = 0;
            this.data.forEach(function (value: number, index: number) {
                res += value;
            })
            return Math.min(255, Math.max(1, res / this.data.length));
        }

        fill(newValue: number): void {
            for (let i = 0; i < this.data.length; i++) this.data[i] = newValue;
        }
    }

}
namespace dataManipulation {
    export function rescale(value: number, scale: number, newScale: number) {
        return value / scale * newScale;
    }
}

