/*******************************************************************************
 *     ___                  _   ____  ____
 *    / _ \ _   _  ___  ___| |_|  _ \| __ )
 *   | | | | | | |/ _ \/ __| __| | | |  _ \
 *   | |_| | |_| |  __/\__ \ |_| |_| | |_) |
 *    \__\_\\__,_|\___||___/\__|____/|____/
 *
 *  Copyright (c) 2014-2019 Appsicle
 *  Copyright (c) 2019-2022 QuestDB
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 ******************************************************************************/

import React, { useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import styled from "styled-components"

import { Splitter, useScreenSize } from "../../components"
import { BusEvent } from "../../consts"

import Editor from "../Editor"
import Footer from "../Footer"
import Modal from "../Modal"
import Notifications from "../Notifications"
import Result from "../Result"
import Settings from "../Settings"
import SideMenu from "../SideMenu"
import Schema from "../Schema"
import Sidebar from "../Sidebar"
import { useLocalStorage } from "providers/LocalStorageProvider"
import { EditorProvider, QuestProvider } from "providers"
import { StoreKey } from "../../utils/localStorage/types"

const Console = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  max-height: 100%;
`

const Top = styled.div`
  position: relative;
  overflow: hidden;
`

const Layout = () => {
  const consoleNode = document.getElementById("console")
  const settingsNode = document.getElementById("settings")
  const sideMenuNode = document.getElementById("sideMenu")
  const modalNode = document.getElementById("modal")
  const { sm } = useScreenSize()
  const { editorSplitterBasis, resultsSplitterBasis, updateSettings } =
    useLocalStorage()

  const handleEditorSplitterChange = useCallback((value) => {
    updateSettings(StoreKey.EDITOR_SPLITTER_BASIS, value)
    setTimeout(() => {
      window.bus.trigger(BusEvent.MSG_ACTIVE_PANEL)
    }, 0)
  }, [])

  const handleResultsSplitterChange = useCallback((value) => {
    updateSettings(StoreKey.RESULTS_SPLITTER_BASIS, value)
    setTimeout(() => {
      window.bus.trigger(BusEvent.MSG_ACTIVE_PANEL)
    }, 0)
  }, [])

  useEffect(() => {
    window.bus.trigger(BusEvent.REACT_READY)
  }, [])

  return (
    <QuestProvider>
      <Sidebar />
      <Footer />
      {consoleNode &&
        createPortal(
          <Console>
            <EditorProvider>
              <Splitter
                direction="vertical"
                fallback={editorSplitterBasis}
                max={300}
                min={200}
                onChange={handleEditorSplitterChange}
              >
                <Top>
                  <Splitter
                    direction="horizontal"
                    fallback={resultsSplitterBasis}
                    max={300}
                    min={200}
                    onChange={handleResultsSplitterChange}
                  >
                    {!sm && <Schema />}
                    <Editor />
                  </Splitter>
                </Top>
                <Result />
              </Splitter>
              <Notifications />
            </EditorProvider>
          </Console>,
          consoleNode,
        )}
      {sideMenuNode && createPortal(<SideMenu />, sideMenuNode)}
      {modalNode && createPortal(<Modal />, modalNode)}
      {settingsNode && createPortal(<Settings />, settingsNode)}
    </QuestProvider>
  )
}

export default Layout
