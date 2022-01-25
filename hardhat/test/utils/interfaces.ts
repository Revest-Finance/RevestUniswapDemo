import { BigNumber } from "ethers";

export interface IConfig {
    asset: string;
    depositAmount: number;
    depositMul: BigNumber;
    split: BigNumber;
    maturityExtension: BigNumber;
    pipeToContract: string;
    isStaking: boolean;
    isMulti: boolean;
    depositStopTime: BigNumber;
    whitelist: boolean;
}

export interface IProvider {
    1: string;
    31337: string;
    4: string;
    137: string;
    250: string;
    43114: string;
}

export interface ITestProvider {
    1: string;
    31337: string;
}
